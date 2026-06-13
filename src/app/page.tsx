import { auth, signIn, signOut } from "@/lib/auth"
import Link from "next/link"

export default async function HomePage() {
  const session = await auth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-slate-50 to-slate-200 text-slate-800">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Moring SSO Starter</h1>
          <p className="text-sm text-slate-500">
            A standalone Next.js boilerplate for Moring OIDC Authentication
          </p>
        </div>
        
        <div className="mt-8">
          {session ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold shadow-sm">
                {session.user?.name?.[0] || "U"}
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold">환영합니다, {session.user?.name}님!</h2>
                <p className="text-sm text-slate-500">{session.user?.email}</p>
              </div>
              
              <div className="w-full pt-4 space-y-3">
                <Link 
                  href="/protected" 
                  className="w-full block text-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  보호된 페이지로 이동
                </Link>
                <form action={async () => { 
                  "use server"; 
                  await signOut(); 
                }}>
                  <button 
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
                  >
                    로그아웃
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                <p className="text-sm text-slate-600 text-center">
                  현재 로그아웃 상태입니다. 아래 버튼을 눌러 Moring 계정으로 로그인하세요.
                </p>
              </div>
              <form action={async () => { 
                "use server"; 
                await signIn("moring"); 
              }}>
                <button 
                  type="submit"
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-[1.02]"
                >
                  Moring으로 로그인
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
