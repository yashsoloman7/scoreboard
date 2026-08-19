'use server';

// src/actions/timer.ts - Server Actions for Authoritative Live Timer Control

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import { Permissions } from '@/lib/auth/roles';
import { TimerControlActionSchema } from '@/lib/validation/schemas';
import { revalidatePath } from 'next/cache';

export async function controlTimer(actionPayload: unknown) {
  const user = await requirePermission(
    Permissions.canControlLiveTimer,
    'Unauthorized to operate the competition timer'
  );
  const validated = TimerControlActionSchema.parse(actionPayload);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc('control_timer_event', {
    p_performance_id: validated.performanceId,
    p_action: validated.action,
    p_duration_seconds: validated.durationSeconds || null,
  });

  if (error) {
    throw new Error(`Timer control operation failed: ${error.message}`);
  }

  // Log audit
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: `TIMER_${validated.action.toUpperCase()}`,
    entity: 'timers',
    entity_id: validated.performanceId,
    new_state: data,
  });

  revalidatePath('/admin/control-room');
  revalidatePath('/judge');

  return data;
}
