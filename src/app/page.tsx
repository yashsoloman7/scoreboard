import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

export default async function Page() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Partial<ResponseCookie> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )

  const { data: todos } = await supabase.from('todos').select()

  return (
    <ul>
      {todos?.map((todo: any) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
