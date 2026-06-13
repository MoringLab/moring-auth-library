from django.conf import settings
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from moring_auth import MoringAuth

class MoringAuthMiddleware(MiddlewareMixin):
    """
    Django middleware to protect views and verify Moring SSO tokens.
    Populates `request.moring_user` with user claims if valid.
    """
    def __init__(self, get_response=None):
        super().__init__(get_response)
        
        # Load credentials from Django global settings
        issuer = getattr(settings, "MORING_ISSUER", None)
        client_id = getattr(settings, "MORING_CLIENT_ID", None)
        client_secret = getattr(settings, "MORING_CLIENT_SECRET", None)
        redirect_uri = getattr(settings, "MORING_REDIRECT_URI", None)
        scope = getattr(settings, "MORING_SCOPE", "openid email profile")
        
        self.cookie_name = getattr(settings, "MORING_COOKIE_NAME", "moring_session")
        self.required_paths = getattr(settings, "MORING_REQUIRED_PATHS", [])
        self.public_paths = getattr(settings, "MORING_PUBLIC_PATHS", [])

        self.auth_client = MoringAuth(
            issuer=issuer,
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            scope=scope
        )

    def process_request(self, request):
        path = request.path_info
        
        # 1. Skip checks if route is explicitly marked public
        is_public = any(path.startswith(p) for p in self.public_paths)
        if is_public:
            request.moring_user = None
            return None

        # 2. Check if route requires authentication (if required_paths is defined)
        is_required = any(path.startswith(p) for p in self.required_paths) if self.required_paths else True

        # 3. Extract token from Cookie or Authorization header
        token = request.COOKIES.get(self.cookie_name)
        if not token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            request.moring_user = None
            if is_required:
                return JsonResponse({"error": "Unauthorized: No session token provided"}, status=401)
            return None

        # 4. Verify token synchronously (fits Django sync model)
        try:
            user = self.auth_client.verify_token_sync(token)
            request.moring_user = user
        except Exception as e:
            request.moring_user = None
            if is_required:
                return JsonResponse({"error": f"Unauthorized: Invalid token - {str(e)}"}, status=401)
            
        return None
