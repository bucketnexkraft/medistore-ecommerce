<?php

namespace App\Http\Controllers;

use App\Models\Newsletter;
use App\Models\Page;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FrontendController extends Controller
{
    public function page(?string $pages = null)
    {
        $slug = trim(strtolower((string) $pages));

        if ($slug === '' || $slug === 'home') {
            $page = Page::query()
                ->where('is_default', true)
                ->where('status', true)
                ->first();
        } else {
            $page = Page::query()
                ->whereRaw('LOWER(slug) = ?', [$slug])
                ->where('status', true)
                ->first();
        }

        if (!$page) {
            abort(404);
        }

        return view('frontend.basic.pages', compact('page'));
    }

    public function subscribeNewsletter(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        Newsletter::firstOrCreate(['email' => $validated['email']]);

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json([
                'message' => 'Newsletter Subscribed Successfully',
            ]);
        }

        return back()->with('success', 'Newsletter Subscribed Successfully');
    }

    public function changeLocale(Request $request)
    {
        $locale = strtolower((string) $request->query('locale', 'en'));

        $exists = DB::table('languages')
            ->whereRaw('LOWER(code) = ?', [$locale])
            ->exists();

        session(['locale' => $exists ? $locale : 'en']);

        return back()->with('success', 'Language Changed Successfully');
    }
}
