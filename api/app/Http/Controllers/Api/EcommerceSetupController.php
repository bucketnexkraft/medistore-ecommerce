<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\EcommerceSetupService;
use Illuminate\Http\Request;

class EcommerceSetupController extends Controller
{
    public function __construct(private readonly EcommerceSetupService $service)
    {
    }

    public function show(Request $request)
    {
        return response()->json(
            $this->service->getResponse($request->boolean('after_payment') || $request->boolean('include_paid')),
            200
        );
    }

    public function postPaymentOptions()
    {
        return response()->json($this->service->getPostPaymentOptions(), 200);
    }

    public function publicOptions()
    {
        return response()->json($this->service->getPublicOptions(), 200);
    }

    public function publicPremiumTemplates(Request $request)
    {
        $companyId = null;

        try {
            $companyId = auth('api')->user()?->company_id;
        } catch (\Throwable) {
            // Public visitors may not have a valid API token.
        }

        return response()->json($this->service->getPublicPremiumTemplateOptions(
            trim((string) $request->query('search', '')),
            (int) $request->query('page', 1),
            (int) $request->query('perPage', 20),
            $request->filled('template_id') ? (int) $request->query('template_id') : null,
            $request->filled('exclude_template_id') ? (int) $request->query('exclude_template_id') : null,
            $companyId ? (string) $companyId : null,
        ), 200);
    }

    public function publicPreviewToken(Request $request)
    {
        return response()->json(
            $this->service->getPublicTemplatePreviewByToken(trim((string) $request->query('template_id', ''))),
            200
        );
    }

    public function publicPreview(int $templateId)
    {
        return response()->json($this->service->getPublicTemplatePreview($templateId), 200);
    }

    public function applyTemplate(Request $request)
    {
        $validated = $request->validate([
            'template_id' => 'required|integer',
            'category_id' => 'required|integer',
            'seed_demo_data' => ['nullable', 'boolean'],
        ]);

        return response()->json(
            $this->service->applyTemplate(
                (int) $validated['template_id'],
                (int) $validated['category_id'],
                $request->has('seed_demo_data') ? $request->boolean('seed_demo_data') : null,
            ),
            200
        );
    }
}
