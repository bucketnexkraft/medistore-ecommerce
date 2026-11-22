<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Services\Backoffice\ContentManagementService;
use Illuminate\Http\Request;

class ContentManagementController extends Controller
{
    public function __construct(private ContentManagementService $contentManagementService) {}

    private function ensureSuperAdmin()
    {
        $user = auth()->user();

        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Forbidden. Super admin access required.',
            ], 403);
        }

        return null;
    }

    public function pages(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->pages($request);
    }

    public function storePage(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->storePage($request);
    }

    public function showPage(int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->showPage($id);
    }

    public function updatePage(Request $request, int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->updatePage($request, $id);
    }

    public function deletePage(int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->deletePage($id);
    }

    public function syncPageSections(Request $request, int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->syncPageSections($request, $id);
    }

    public function sectionLibrary()
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->sectionLibrary();
    }

    public function updateSectionContent(Request $request, string $name)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->updateSectionContent($request, $name);
    }

    public function menuItems()
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->menuItems();
    }

    public function storeMenuItem(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->storeMenuItem($request);
    }

    public function updateMenuItem(Request $request, int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->updateMenuItem($request, $id);
    }

    public function sortMenu(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->sortMenu($request);
    }

    public function deleteMenuItem(int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->contentManagementService->deleteMenuItem($id);
    }
}
