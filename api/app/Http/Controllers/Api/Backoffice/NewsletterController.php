<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\Newsletter;
use App\Services\DynamicMailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class NewsletterController extends Controller
{
    public function __construct(private DynamicMailService $dynamicMailService)
    {
    }

    private function ensureAuthenticated()
    {
        $user = Auth::user();
        if (! $user) {
            return response()->json([
                'status' => 0,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        return null;
    }

    private function scopedNewsletterQuery()
    {
        $query = Newsletter::query();
        $user = Auth::user();

        if (
            $user
            && ! $user->isSuperAdmin()
            && Schema::hasTable('newsletters')
            && Schema::hasColumn('newsletters', 'company_id')
        ) {
            $companyId = trim((string) ($user->company_id ?? ''));

            if ($companyId === '') {
                $query->whereRaw('1 = 0');
            } else {
                $query->where('company_id', $companyId);
            }
        }

        return $query;
    }

    public function index(Request $request)
    {
        $forbidden = $this->ensureAuthenticated();
        if ($forbidden) return $forbidden;

        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));

        $query = $this->scopedNewsletterQuery();

        if ($search !== '') {
            $query->where('email', 'like', "%{$search}%");
        }

        $rows = $query->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Newsletter subscriptions fetched successfully.',
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    public function sendEmail(Request $request, int $id)
    {
        $forbidden = $this->ensureAuthenticated();
        if ($forbidden) return $forbidden;

        $newsletter = $this->scopedNewsletterQuery()->find($id);
        if (!$newsletter) {
            return response()->json([
                'status' => 0,
                'message' => 'Newsletter subscription not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:10000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $emailConfig = $this->dynamicMailService->getEmailConfiguration();
        if (empty($emailConfig['email_method']) || empty($emailConfig['email_send_from'])) {
            return response()->json([
                'status' => 0,
                'message' => 'Please save email configuration first.',
            ], 422);
        }

        $validated = $validator->validated();
        $htmlBody = nl2br(e((string) $validated['message']));

        try {
            $sent = $this->dynamicMailService->sendHtml(
                (string) $newsletter->email,
                (string) $validated['subject'],
                $htmlBody
            );

            if (!$sent) {
                throw new \RuntimeException('Failed to send newsletter email using configured email method.');
            }

            return response()->json([
                'status' => 1,
                'message' => 'Newsletter email sent successfully.',
            ], 200);
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => 'Unable to send newsletter email. Please verify your email configuration.',
                'error' => $exception->getMessage(),
            ], 422);
        }
    }

    public function destroy(int $id)
    {
        $forbidden = $this->ensureAuthenticated();
        if ($forbidden) return $forbidden;

        $newsletter = $this->scopedNewsletterQuery()->find($id);
        if (!$newsletter) {
            return response()->json([
                'status' => 0,
                'message' => 'Newsletter subscription not found.',
            ], 404);
        }

        $newsletter->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Newsletter subscription deleted successfully.',
        ]);
    }
}
