<?php

namespace App\Services\Backoffice;

use App\Constant\Path;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LanguageService
{
    private ?bool $languageImageColumn = null;

    private function hasLanguageImageColumn(): bool
    {
        return $this->languageImageColumn ??= Schema::hasColumn('languages', 'image');
    }

    private function languageImageFolder(): string
    {
        return Path::LANGUAGE_IMAGE_PATH;
    }

    private function uploadLanguageImage(Request $request, string $field, ?string $oldImage = null, string $code = ''): ?string
    {
        if (! $request->hasFile($field)) {
            return $oldImage;
        }

        $file = $request->file($field);
        if (! $file || ! $file->isValid()) {
            return $oldImage;
        }

        $imageName = $code !== '' ? $this->normalizeCode($code) : '';

        return upload($file, $this->languageImageFolder(), $oldImage ?? '', $imageName);
    }

    private function deleteLanguageImage(?string $image): void
    {
        if (! $image) {
            return;
        }

        $path = public_path('images/' . trim($this->languageImageFolder(), '/') . '/' . ltrim($image, '/'));

        if (File::exists($path)) {
            File::delete($path);
        }
    }

    private function decodeLanguageJson(string $raw): ?array
    {
        // Remove UTF-8 BOM if present (common when files are saved from Windows editors).
        $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }

    private function languageDir(): string
    {
        return resource_path('lang');
    }

    private function ensureLanguageDir(): void
    {
        $dir = $this->languageDir();
        if (! File::exists($dir)) {
            File::makeDirectory($dir, 0755, true);
        }
    }

    private function normalizeCode(string $code): string
    {
        return strtolower(trim($code));
    }

    private function sanitizeLangPayload(array $decoded): array
    {
        $normalized = [];
        foreach ($decoded as $key => $value) {
            if (! is_string($key) || trim($key) === '' || ! is_string($value)) {
                continue;
            }
            $normalized[trim($key)] = $value;
        }

        return $normalized;
    }

    private function englishTemplate(): array
    {
        $langPath = resource_path('lang/en.json');
        if (File::exists($langPath)) {
            $raw = File::get($langPath);
            $decoded = $this->decodeLanguageJson($raw);
            if ($decoded !== null) {
                return $decoded;
            }
        }

        return [
            'app_name' => 'stoqio',
            'menu.dashboard' => 'Dashboard',
            'menu.products' => 'Products',
            'menu.sales' => 'Sales',
            'menu.purchases' => 'Purchases',
            'menu.customers' => 'Customers',
            'menu.waitlist' => 'Waitlist',
            'button.save' => 'Save',
            'button.cancel' => 'Cancel',
            'button.edit' => 'Edit',
            'button.delete' => 'Delete',
            'message.success' => 'Success',
            'message.error' => 'Something went wrong',
        ];
    }

    private function ensureEnglishTemplateExists(): string
    {
        $this->ensureLanguageDir();

        $path = $this->languageDir().DIRECTORY_SEPARATOR.'en.json';
        if (! File::exists($path)) {
            File::put(
                $path,
                json_encode($this->englishTemplate(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
        }

        return $path;
    }

    public function index()
    {
        $this->ensureEnglishTemplateExists();
        $this->ensureLanguageDir();
        $hasImageColumn = $this->hasLanguageImageColumn();

        $selectColumns = ['id', 'name', 'code', 'created_at', 'updated_at'];
        if ($hasImageColumn) {
            $selectColumns[] = 'image';
        }

        $rows = DB::table('languages')
            ->select($selectColumns)
            ->orderBy('code')
            ->get()
            ->map(function ($row) use ($hasImageColumn) {
                $filePath = $this->languageDir().DIRECTORY_SEPARATOR.strtolower($row->code).'.json';
                $image = $hasImageColumn ? ($row->image ?? null) : null;

                return [
                    'id' => $row->id,
                    'name' => (string) ($row->name ?? strtoupper((string) $row->code)),
                    'code' => strtolower($row->code),
                    'image' => $image,
                    'image_url' => $image ? get_file($image, $this->languageImageFolder()) : null,
                    'has_json' => File::exists($filePath),
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ];
            })
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Languages fetched successfully.',
            'data' => $rows,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:80',
            'code' => 'required|string|min:2|max:15|regex:/^[a-zA-Z0-9_-]+$/',
            'image' => imageValidation(),
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $code = $this->normalizeCode((string) $request->input('code'));
        $hasImageColumn = $this->hasLanguageImageColumn();

        $exists = DB::table('languages')->whereRaw('LOWER(code) = ?', [$code])->exists();
        if ($exists) {
            return response()->json([
                'status' => 0,
                'message' => 'Language already exists.',
            ], 422);
        }

        $image = $hasImageColumn ? $this->uploadLanguageImage($request, 'image', null, $code) : null;

        $payload = [
            'name' => trim((string) $request->input('name')),
            'code' => $code,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if ($hasImageColumn) {
            $payload['image'] = $image;
        }

        $id = DB::table('languages')->insertGetId($payload);

        $this->ensureEnglishTemplateExists();
        $this->ensureLanguageDir();

        $path = $this->languageDir().DIRECTORY_SEPARATOR.$code.'.json';
        if (! File::exists($path)) {
            File::copy($this->languageDir().DIRECTORY_SEPARATOR.'en.json', $path);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Language created successfully.',
            'data' => [
                'id' => $id,
                'name' => trim((string) $request->input('name')),
                'code' => $code,
                'image' => $image,
                'image_url' => $image ? get_file($image, $this->languageImageFolder()) : null,
                'has_json' => true,
            ],
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $language = DB::table('languages')->where('id', $id)->first();
        $hasImageColumn = $this->hasLanguageImageColumn();
        if (! $language) {
            return response()->json([
                'status' => 0,
                'message' => 'Language not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:80',
            'code' => 'required|string|min:2|max:15|regex:/^[a-zA-Z0-9_-]+$/',
            'image' => imageValidation(),
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $newName = trim((string) $request->input('name'));
        $newCode = $this->normalizeCode((string) $request->input('code'));
        $oldCode = $this->normalizeCode((string) $language->code);
        $newImage = $hasImageColumn
            ? $this->uploadLanguageImage($request, 'image', $language->image ?? null, $newCode)
            : null;

        $exists = DB::table('languages')
            ->whereRaw('LOWER(code) = ?', [$newCode])
            ->where('id', '!=', $id)
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 0,
                'message' => 'Language code already exists.',
            ], 422);
        }

        $payload = [
            'name' => $newName,
            'code' => $newCode,
            'updated_at' => now(),
        ];

        if ($hasImageColumn) {
            $payload['image'] = $newImage;
        }

        DB::table('languages')->where('id', $id)->update($payload);

        // Keep translation file in sync when code changes.
        $this->ensureLanguageDir();
        $oldPath = $this->languageDir().DIRECTORY_SEPARATOR.$oldCode.'.json';
        $newPath = $this->languageDir().DIRECTORY_SEPARATOR.$newCode.'.json';

        if ($oldCode !== $newCode && File::exists($oldPath) && ! File::exists($newPath)) {
            File::move($oldPath, $newPath);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Language updated successfully.',
            'data' => [
                'id' => $id,
                'name' => $newName,
                'code' => $newCode,
                'image' => $newImage,
                'image_url' => $newImage ? get_file($newImage, $this->languageImageFolder()) : null,
            ],
        ], 200);
    }

    public function destroy(int $id)
    {
        $language = DB::table('languages')->where('id', $id)->first();
        $hasImageColumn = $this->hasLanguageImageColumn();
        if (! $language) {
            return response()->json([
                'status' => 0,
                'message' => 'Language not found.',
            ], 404);
        }

        $code = $this->normalizeCode((string) $language->code);
        if ($code === 'en') {
            return response()->json([
                'status' => 0,
                'message' => 'Default language (en) cannot be deleted.',
            ], 422);
        }

        $totalLanguages = (int) DB::table('languages')->count();
        if ($totalLanguages <= 1) {
            return response()->json([
                'status' => 0,
                'message' => 'At least one language must remain.',
            ], 422);
        }

        DB::table('languages')->where('id', $id)->delete();
        if ($hasImageColumn) {
            $this->deleteLanguageImage($language->image ?? null);
        }

        $this->ensureLanguageDir();
        $path = $this->languageDir().DIRECTORY_SEPARATOR.$code.'.json';
        if (File::exists($path)) {
            File::delete($path);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Language deleted successfully.',
        ], 200);
    }

    public function publicLanguages()
    {
        $rtlCodes = ['ar', 'fa', 'he', 'ur'];
        $defaultCode = 'en';
        $hasImageColumn = $this->hasLanguageImageColumn();

        $selectColumns = ['id', 'name', 'code'];
        if ($hasImageColumn) {
            $selectColumns[] = 'image';
        }

        $rows = Cache::remember('storefront:public-languages', now()->addMinutes(10), function () use ($selectColumns, $defaultCode, $rtlCodes, $hasImageColumn) {
            return DB::table('languages')
                ->select($selectColumns)
                ->orderBy('name')
                ->get()
                ->map(function ($row) use ($defaultCode, $rtlCodes, $hasImageColumn) {
                    $code = strtolower((string) $row->code);
                    $filePath = $this->languageDir().DIRECTORY_SEPARATOR.$code.'.json';
                    $image = $hasImageColumn ? ($row->image ?? null) : null;

                    return [
                        'id' => (int) $row->id,
                        'name' => (string) ($row->name ?? strtoupper($code)),
                        'code' => $code,
                        'image' => $image,
                        'image_url' => $image ? get_file($image, $this->languageImageFolder()) : null,
                        'has_json' => File::exists($filePath),
                        'is_default' => $code === $defaultCode,
                        'direction' => in_array($code, $rtlCodes, true) ? 'rtl' : 'ltr',
                    ];
                })
                ->values()
                ->all();
        });

        return response()->json([
            'status' => 1,
            'message' => 'Languages fetched successfully.',
            'data' => $rows,
        ], 200);
    }

    public function downloadEnglishTemplate(): BinaryFileResponse
    {
        $path = $this->ensureEnglishTemplateExists();

        return response()->download($path, 'en.json', [
            'Content-Type' => 'application/json',
        ]);
    }

    public function downloadByCode(string $code): BinaryFileResponse
    {
        $normalizedCode = $this->normalizeCode($code);
        $path = $this->languageDir().DIRECTORY_SEPARATOR.$normalizedCode.'.json';

        if (! File::exists($path)) {
            abort(404, 'Language JSON file not found.');
        }

        return response()->download($path, $normalizedCode.'.json', [
            'Content-Type' => 'application/json',
        ]);
    }

    public function uploadJson(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'language_id' => 'required|integer|exists:languages,id',
            'file' => 'required|file|mimes:json|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $language = DB::table('languages')
            ->select(['id', 'code'])
            ->where('id', (int) $request->input('language_id'))
            ->first();

        if (! $language) {
            return response()->json([
                'status' => 0,
                'message' => 'Language not found.',
            ], 404);
        }

        $file = $request->file('file');
        $allowedMimeTypes = [
            'application/json',
            'text/json',
            'application/x-json',
        ];
        if (! $file || ! in_array((string) $file->getMimeType(), $allowedMimeTypes, true)) {
            return response()->json([
                'status' => 0,
                'message' => 'Only JSON files are allowed.',
            ], 422);
        }

        if (strtolower((string) $file->getClientOriginalExtension()) !== 'json') {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid file extension. Please upload a .json file.',
            ], 422);
        }

        $contents = $file ? file_get_contents($file->getRealPath()) : false;
        if ($contents === false) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to read uploaded file.',
            ], 422);
        }

        $decoded = $this->decodeLanguageJson($contents);
        if ($decoded === null) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid JSON format. Please upload a valid JSON object.',
            ], 422);
        }
        if (array_is_list($decoded)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid language JSON. Root must be an object of key-value pairs.',
            ], 422);
        }

        $normalized = [];
        $invalidEntries = [];
        foreach ($decoded as $key => $value) {
            // json_decode may cast numeric-like object keys to integers in PHP arrays.
            // Normalize every scalar key to string so valid keys like "404" are accepted.
            if (! is_string($key) && ! is_int($key) && ! is_float($key) && ! is_bool($key)) {
                $invalidEntries[] = 'All translation keys must be strings.';

                continue;
            }
            $trimmedKey = trim((string) $key);
            if ($trimmedKey === '') {
                $invalidEntries[] = 'Translation keys cannot be empty.';

                continue;
            }
            if (! is_string($value)) {
                $invalidEntries[] = "Value for key '{$trimmedKey}' must be a string.";

                continue;
            }
            $normalized[$trimmedKey] = $value;
        }

        if (! empty($invalidEntries)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid language JSON structure.',
                'errors' => array_values(array_unique($invalidEntries)),
            ], 422);
        }

        if (empty($normalized)) {
            return response()->json([
                'status' => 0,
                'message' => 'Language JSON is empty.',
            ], 422);
        }

        $this->ensureLanguageDir();
        $code = $this->normalizeCode((string) $language->code);
        $path = $this->languageDir().DIRECTORY_SEPARATOR.$code.'.json';
        File::put($path, json_encode($normalized, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        DB::table('languages')->where('id', (int) $language->id)->update([
            'updated_at' => now(),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Language JSON updated successfully.',
            'data' => [
                'language_id' => (int) $language->id,
                'code' => $code,
                'keys_count' => count($normalized),
            ],
        ]);
    }

    public function getLanguageJson(string $code = 'en')
    {
        $normalizedCode = $this->normalizeCode($code);
        $path = $this->languageDir().DIRECTORY_SEPARATOR.$normalizedCode.'.json';
        $fallbackPath = $this->languageDir().DIRECTORY_SEPARATOR.'en.json';

        if (! File::exists($path) && File::exists($fallbackPath)) {
            $path = $fallbackPath;
            $normalizedCode = 'en';
        }

        if (! File::exists($path)) {
            return response()->json([
                'status' => 0,
                'message' => 'Language file not found.',
            ], 404);
        }

        $raw = File::get($path);
        $decoded = $this->decodeLanguageJson($raw);
        if ($decoded === null) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid language JSON file.',
            ], 422);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Language JSON fetched successfully.',
            'code' => $normalizedCode,
            'data' => $this->sanitizeLangPayload($decoded),
        ], 200);
    }

    public function registerMissingKey(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'key' => 'required|string|max:190',
            'fallback' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $key = trim((string) $request->input('key'));
        $fallback = (string) $request->input('fallback', $key);

        $this->ensureEnglishTemplateExists();
        $path = $this->languageDir().DIRECTORY_SEPARATOR.'en.json';
        $raw = File::get($path);
        $decoded = $this->decodeLanguageJson($raw);
        if ($decoded === null) {
            $decoded = [];
        }

        if (! array_key_exists($key, $decoded)) {
            $decoded[$key] = $fallback;
            ksort($decoded);
            File::put($path, json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        return response()->json([
            'status' => 1,
            'message' => 'Missing translation key registered.',
            'data' => ['key' => $key],
        ], 200);
    }
}
