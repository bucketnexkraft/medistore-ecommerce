<?php 
namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

class ImageService
{
    private const DEFAULT_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    private const DEFAULT_IMAGE_MIME_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
    ];

    public static function assertUploadIsSafe(
        UploadedFile $file,
        array $allowedExtensions,
        array $allowedMimeTypes,
        int $maxKilobytes,
        string $field = 'file'
    ): void {
        if (! $file->isValid()) {
            throw ValidationException::withMessages([
                $field => ['Uploaded file is invalid.'],
            ]);
        }

        $extension = strtolower((string) $file->getClientOriginalExtension());
        $mimeType = strtolower((string) $file->getMimeType());
        $sizeInKilobytes = (int) ceil(((int) $file->getSize()) / 1024);

        if (! in_array($extension, $allowedExtensions, true)) {
            throw ValidationException::withMessages([
                $field => ['Unsupported file extension.'],
            ]);
        }

        if (! in_array($mimeType, $allowedMimeTypes, true)) {
            throw ValidationException::withMessages([
                $field => ['Unsupported file type.'],
            ]);
        }

        if ($sizeInKilobytes > $maxKilobytes) {
            throw ValidationException::withMessages([
                $field => ["File size must not exceed {$maxKilobytes} KB."],
            ]);
        }
    }

    public static function assertImageUpload(UploadedFile $file, string $field = 'image', int $maxKilobytes = 4096): void
    {
        self::assertUploadIsSafe(
            $file,
            self::DEFAULT_IMAGE_EXTENSIONS,
            self::DEFAULT_IMAGE_MIME_TYPES,
            $maxKilobytes,
            $field
        );
    }

    public static function upload(UploadedFile $file, $folder = 'general', ?array $constraints = null)
    {
        $constraints = $constraints ?? [
            'extensions' => self::DEFAULT_IMAGE_EXTENSIONS,
            'mime_types' => self::DEFAULT_IMAGE_MIME_TYPES,
            'max_kb' => 4096,
            'field' => 'image',
        ];

        self::assertUploadIsSafe(
            $file,
            $constraints['extensions'] ?? self::DEFAULT_IMAGE_EXTENSIONS,
            $constraints['mime_types'] ?? self::DEFAULT_IMAGE_MIME_TYPES,
            (int) ($constraints['max_kb'] ?? 4096),
            (string) ($constraints['field'] ?? 'image')
        );

        $extension = strtolower((string) $file->getClientOriginalExtension());
        $filename = time() . '_' . uniqid() . '.' . $extension;
        $path = public_path('images/' . trim((string) $folder, '/'));

        if (!file_exists($path)) {
            mkdir($path, 0755, true);
        }

        $file->move($path, $filename);

        return $filename;
    }

    public static function url($path, $folder = 'general')
    {
        return get_file($path, $folder);
    }

    public static function delete($path, $folder = 'general')
    {
        if (!$path) return;

        $disk = config('filesystems.default', env('FILESYSTEM_DRIVER', 'local_custom'));

        // Build relative path for both local and cloud
        $relativePath = "uploads/{$folder}/{$path}";

        if ($disk == 'local_custom') {
            $fullPath = public_path($relativePath);
            if (file_exists($fullPath)) {
                unlink($fullPath);
                return true;
            }
        } else {
            // Ensure cloud gets full relative path like: uploads/product-images/image123.jpg
            Storage::disk($disk)->delete($relativePath);
        }
    }
}
