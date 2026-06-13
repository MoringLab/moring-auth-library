import os
from fastapi import FastAPI, Depends, Response
from fastapi.responses import RedirectResponse
from moring_auth import MoringAuth
from moring_auth_fastapi import require_auth

app = FastAPI()

# Pre-fill environment variables for demo purposes
os.environ["MORING_ISSUER"] = "https://sso.moring.co"
os.environ["MORING_CLIENT_ID"] = "demo-client-id"
os.environ["MORING_CLIENT_SECRET"] = "demo-client-secret"
os.environ["MORING_REDIRECT_URI"] = "http://localhost:8000/auth/callback"

auth = MoringAuth()

@app.get("/login")
async def login():
    url, _, _, _ = await auth.get_login_url()
    return RedirectResponse(url=url)

@app.get("/auth/callback")
async def callback(code: str, response: Response):
    tokens = await auth.handle_callback(code)
    response.set_cookie(key="moring_session", value=tokens["id_token"], httponly=True)
    return {"message": "Authenticated successfully", "tokens": tokens}

# Route protection using FastAPI Depends and moring-auth-fastapi
@app.get("/secure")
async def secure(user = Depends(require_auth(auth))):
    return {
        "message": "Hello from secure FastAPI endpoint!",
        "user": user
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
