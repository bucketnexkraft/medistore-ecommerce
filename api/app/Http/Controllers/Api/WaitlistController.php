<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\WaitlistService;
use Illuminate\Http\Request;

class WaitlistController extends Controller
{
    public function __construct(private readonly WaitlistService $service)
    {
    }

    public function index(Request $request)
    {
        return response()->json($this->service->list($request), 200);
    }

    public function store(Request $request)
    {
        $payload = $this->service->store($request);
        return response()->json($payload, $payload['status'] ? 200 : 422);
    }

    public function show(string $id)
    {
        return response()->json($this->service->show($id), 200);
    }

    public function claim(string $id)
    {
        $payload = $this->service->claim($id);
        return response()->json($payload, $payload['status'] ? 200 : 422);
    }

    public function release(string $id)
    {
        $payload = $this->service->release($id);
        return response()->json($payload, $payload['status'] ? 200 : 422);
    }

    public function cancel(string $id)
    {
        $payload = $this->service->cancel($id);
        return response()->json($payload, $payload['status'] ? 200 : 422);
    }
}

