'use server';

// src/actions/timer.ts - Server Actions for Authoritative Live Timer Control

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import { Permissions } from '@/lib/auth/roles';
import { TimerControlActionSchema } from '@/lib/validation/schemas';
import { revalidatePath } from 'next/cache';

export async function controlTimer(actionPayload: unknown) {
  try {
    const user = await requirePermission(
      Permissions.canControlLiveTimer,
      'Unauthorized to operate the competition timer'
    );
    const validated = TimerControlActionSchema.parse(actionPayload);
    const supabase = await createServerSupabaseClient();

    let timerResult: any = null;
    let rpcFailed = false;

    // 1. Try stored procedure
    try {
      const { data, error } = await supabase.rpc('control_timer_event', {
        p_performance_id: validated.performanceId,
        p_action: validated.action,
        p_duration_seconds: validated.durationSeconds || null,
      });

      if (!error && data) {
        timerResult = data;
      } else {
        rpcFailed = true;
      }
    } catch {
      rpcFailed = true;
    }

    // 2. Direct fallback
    if (rpcFailed || !timerResult) {
      const now = new Date();
      const nowIso = now.toISOString();

      // Check or create timer row
      let { data: timer } = await supabase
        .from('timers')
        .select('*')
        .eq('performance_id', validated.performanceId)
        .maybeSingle();

      if (!timer) {
        const { data: newTimer } = await supabase
          .from('timers')
          .insert({
            performance_id: validated.performanceId,
            configured_duration_seconds: validated.durationSeconds || 300,
            status: 'idle',
          })
          .select()
          .single();
        timer = newTimer;
      }

      let updatePayload: any = {
        last_updated_by: user.id,
        updated_at: nowIso,
      };

      const currentAccum = Number(timer?.accumulated_duration_seconds || 0);

      if (validated.action === 'start') {
        updatePayload.status = 'running';
        updatePayload.started_at = nowIso;
        updatePayload.paused_at = null;
        updatePayload.accumulated_duration_seconds = 0;

        // Update performance status to 'performing'
        await supabase
          .from('performances')
          .update({ status: 'performing', started_at: nowIso })
          .eq('id', validated.performanceId);
      } else if (validated.action === 'pause') {
        let accum = currentAccum;
        if (timer?.status === 'running' && timer?.started_at) {
          const elapsed = Math.max(0, (now.getTime() - new Date(timer.started_at).getTime()) / 1000);
          accum += elapsed;
        }
        updatePayload.status = 'paused';
        updatePayload.paused_at = nowIso;
        updatePayload.accumulated_duration_seconds = accum;
      } else if (validated.action === 'resume') {
        updatePayload.status = 'running';
        updatePayload.started_at = nowIso;
        updatePayload.paused_at = null;

        await supabase
          .from('performances')
          .update({ status: 'performing' })
          .eq('id', validated.performanceId);
      } else if (validated.action === 'stop') {
        let accum = currentAccum;
        if (timer?.status === 'running' && timer?.started_at) {
          const elapsed = Math.max(0, (now.getTime() - new Date(timer.started_at).getTime()) / 1000);
          accum += elapsed;
        }
        updatePayload.status = 'stopped';
        updatePayload.paused_at = nowIso;
        updatePayload.accumulated_duration_seconds = accum;

        await supabase
          .from('performances')
          .update({ status: 'completed', completed_at: nowIso })
          .eq('id', validated.performanceId);
      } else if (validated.action === 'reset') {
        updatePayload.status = 'idle';
        updatePayload.started_at = null;
        updatePayload.paused_at = null;
        updatePayload.accumulated_duration_seconds = 0;
        updatePayload.overtime_seconds = 0;

        await supabase
          .from('performances')
          .update({ status: 'scheduled' })
          .eq('id', validated.performanceId);
      } else if (validated.action === 'update_duration' && validated.durationSeconds) {
        updatePayload.configured_duration_seconds = validated.durationSeconds;
      }

      const { data: updatedTimer, error: timerErr } = await supabase
        .from('timers')
        .update(updatePayload)
        .eq('performance_id', validated.performanceId)
        .select()
        .single();

      if (timerErr) {
        console.error('Direct timer update error:', timerErr);
      } else {
        timerResult = updatedTimer;
      }
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: `TIMER_${validated.action.toUpperCase()}`,
      entity: 'timers',
      entity_id: validated.performanceId,
      new_state: timerResult,
    });

    revalidatePath('/admin/control-room');
    revalidatePath('/judge');

    return { success: true, timer: timerResult };
  } catch (err: unknown) {
    console.error('Timer control error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Timer operation failed' };
  }
}

export async function advancePerformanceSlot(
  currentPerformanceId: string,
  nextPerformanceId?: string
) {
  const user = await requirePermission(
    Permissions.canAdvancePerformances,
    'Unauthorized to advance performance slots'
  );
  const supabase = await createServerSupabaseClient();

  // Mark current as completed
  await supabase
    .from('performances')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', currentPerformanceId);

  // If next slot provided, mark as on_deck or performing
  if (nextPerformanceId) {
    await supabase
      .from('performances')
      .update({ status: 'on_deck' })
      .eq('id', nextPerformanceId);
  }

  revalidatePath('/admin/control-room');
  revalidatePath('/judge');

  return { success: true };
}
