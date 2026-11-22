<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\StorefrontHomeBuilderService;
use App\Services\ImageService;
use Illuminate\Http\Request;

class StorefrontHomeBuilderController extends Controller
{
    public function __construct(private readonly StorefrontHomeBuilderService $service)
    {
    }

    public function show(Request $request)
    {
        return response()->json($this->service->getResponse(), 200);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'builder' => 'required|array',
            'builder.settings' => 'sometimes|array',
            'builder.settings.theme' => 'sometimes|array',
            'builder.settings.theme.primary_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'builder.settings.theme.secondary_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'builder.settings.theme.font_family' => ['sometimes', 'string', 'max:100'],
        ]);

        // The builder contains dynamic pages, sections, and actions. Laravel's
        // nested validation result only retains explicitly validated nested
        // keys, so use the original array after validation to avoid silently
        // dropping the canvas payload and saving an empty builder.
        return response()->json(
            $this->service->updateResponse($request->input('builder')),
            200
        );
    }

    public function uploadMedia(Request $request)
    {
        $request->validate([
            'files' => 'required|array|min:1|max:20',
            'files.*' => 'required|image|max:4096',
        ]);

        $media = collect($request->file('files', []))
            ->map(function ($file) {
                $name = ImageService::upload($file, 'storefront-sections');

                return [
                    'name' => $file->getClientOriginalName(),
                    'url' => get_file($name, 'storefront-sections'),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'status' => 1,
            'message' => 'Section media uploaded successfully.',
            'data' => $media,
        ], 201);
    }
}
