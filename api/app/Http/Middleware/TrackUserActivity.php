<?php

namespace App\Http\Middleware;

use App\Models\UserActivity;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Throwable;

class TrackUserActivity
{
    private const MAX_PAYLOAD_BYTES = 60000;

    private array $sensitiveKeys = [
        'password',
        'password_confirmation',
        'token',
        'access_token',
        'refresh_token',
        'private_code',
        'old_password',
        'new_password',
        'secret',
    ];
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Get the authenticated user (if any)
        $user = Auth::user();

        // Check if response is a BinaryFileResponse (download)
        $isDownload = $response instanceof \Symfony\Component\HttpFoundation\BinaryFileResponse;
        
        // Never call $request->all() here; on multipart requests that forces file
        // conversion and can break upload temp-file handling.
        $payload = $this->sanitizePayload($request->input());

        try {
            // Activity logging must never turn a successful application response
            // into an error when a request contains a large builder payload.
            UserActivity::create([
                'user_id' => $user?->id, // nullable if guest
                'ip_address' => $request->ip(),
                'user_agent' => $request->header('User-Agent'),
                'endpoint' => $request->path(),
                'method' => $request->method(),
                'status_code' => $isDownload ? 200 : $response->status(),
                'payload' => $this->encodePayload($payload),
            ]);
        } catch (Throwable $exception) {
            report($exception);
        }

        return $response;
    }

    private function sanitizePayload(array $payload): array
    {
        // Builder metadata is response-only catalog data. It is large, changes
        // frequently, and is not useful in an activity record.
        if (isset($payload['builder']) && is_array($payload['builder'])) {
            unset($payload['builder']['meta']);
        }

        array_walk_recursive($payload, function (&$value, $key) {
            if (in_array(strtolower((string) $key), $this->sensitiveKeys, true)) {
                $value = '***';
            }
        });

        return $payload;
    }

    private function encodePayload(array $payload): string
    {
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if (! is_string($encoded)) {
            return '{}';
        }

        if (strlen($encoded) <= self::MAX_PAYLOAD_BYTES) {
            return $encoded;
        }

        return json_encode([
            '_truncated' => true,
            'original_size_bytes' => strlen($encoded),
        ]);
    }
}
