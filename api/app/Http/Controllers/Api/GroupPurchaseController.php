<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\GroupPurchaseService;
use Illuminate\Http\Request;

class GroupPurchaseController extends Controller
{
    public function __construct(private readonly GroupPurchaseService $service)
    {
    }

    public function publicIndex(Request $request)
    {
        return $this->service->publicIndex($request);
    }

    public function invitationDetails(string $token)
    {
        return $this->service->invitationDetails($token);
    }

    public function myGroups()
    {
        return $this->service->myGroups();
    }

    public function show(string $id)
    {
        return $this->service->show($id);
    }

    public function store(Request $request)
    {
        return $this->service->store($request);
    }

    public function join(string $id)
    {
        return $this->service->join($id);
    }

    public function joinByInvitation(string $token)
    {
        return $this->service->joinByInvitation($token);
    }

    public function messages(string $id)
    {
        return $this->service->messages($id);
    }

    public function stream(string $id)
    {
        return $this->service->stream($id);
    }

    public function sendMessage(Request $request, string $id)
    {
        return $this->service->sendMessage($request, $id);
    }
}
