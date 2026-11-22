<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Services\Backoffice\LanguageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LanguageController extends Controller
{
    public function __construct(private readonly LanguageService $languageService) {}

    private function ensureSuperAdmin()
    {
        $user = Auth::user();

        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Forbidden. Super admin access required.',
            ], 403);
        }

        return null;
    }

    public function index()
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->languageService->index();
    }

    public function store(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->languageService->store($request);
    }

    public function update(Request $request, int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->languageService->update($request, $id);
    }

    public function destroy(int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->languageService->destroy($id);
    }

    public function publicLanguages()
    {
        return $this->languageService->publicLanguages();
    }

    public function downloadEnglishTemplate(): BinaryFileResponse
    {
        if ($this->ensureSuperAdmin()) {
            abort(403, 'Forbidden. Super admin access required.');
        }

        return $this->languageService->downloadEnglishTemplate();
    }

    public function downloadByCode(string $code): BinaryFileResponse
    {
        if ($this->ensureSuperAdmin()) {
            abort(403, 'Forbidden. Super admin access required.');
        }

        return $this->languageService->downloadByCode($code);
    }

    public function uploadJson(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->languageService->uploadJson($request);
    }

    public function getLanguageJson(string $code = 'en')
    {
        return $this->languageService->getLanguageJson($code);
    }

    public function registerMissingKey(Request $request)
    {
        return $this->languageService->registerMissingKey($request);
    }
}
