class CorsMiddleware:
    """Small, dependency-free CORS layer for the separately served Vite client."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from django.conf import settings
        from django.http import HttpResponseForbidden

        origin = request.headers.get("Origin", "").rstrip("/")
        if request.method == "OPTIONS" and origin and origin not in settings.CORS_ALLOWED_ORIGINS:
            return HttpResponseForbidden("Origin is not allowed.")
        if request.method == "OPTIONS":
            from django.http import HttpResponse
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)
        if origin in settings.CORS_ALLOWED_ORIGINS:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type"
        return response
