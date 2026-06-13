import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function ProtectedPage() {
  const session = await auth()

  // 세션이 없으면 메인 페이지로 리다이렉트
  if (!session) {
    redirect("/")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-50 text-slate-800">
      <div className="max-w-2xl w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-3xl font-extrabold text-slate-900">보호된 페이지</h1>
          <p className="mt-2 text-sm text-slate-500">
            이 페이지는 Moring SSO를 통해 로그인한 사용자만 볼 수 있습니다.
          </p>
        </div>
        
        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-slate-700">현재 세션 정보 (Server-Side)</h2>
          <pre className="text-xs bg-slate-800 text-green-400 p-4 rounded overflow-x-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        <div className="pt-4">
          <Link 
            href="/" 
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  )
}
