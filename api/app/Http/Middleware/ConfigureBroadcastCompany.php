<?php

namespace App\Http\Middleware;

use App\Models\GroupPurchase;
use App\Support\CompanyBroadcastConfig;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ConfigureBroadcastCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        $channelName = (string) $request->input('channel_name', '');

        if (preg_match('/^private-group-purchase\.(.+)$/', $channelName, $matches) === 1) {
            $groupId = $matches[1];
            $group = GroupPurchase::withoutGlobalScope('company')
                ->with('company')
                ->find($groupId);

            if ($group) {
                CompanyBroadcastConfig::apply($group->company);
            }
        }

        return $next($request);
    }
}
