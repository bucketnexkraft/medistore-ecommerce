<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\PayoutRequestService;
use Illuminate\Http\Request;

class PayoutRequestController extends Controller
{
    public function __construct(private readonly PayoutRequestService $service)
    {
    }

    public function customerIndex()
    {
        return $this->service->customerIndex();
    }

    public function customerStore(Request $request)
    {
        return $this->service->customerStore($request);
    }

    public function referralIndex()
    {
        return $this->service->referralIndex();
    }

    public function referralStore(Request $request)
    {
        return $this->service->referralStore($request);
    }

    public function companyIndex(Request $request)
    {
        return $this->service->companyIndex($request);
    }

    public function companyApprove(string $id)
    {
        return $this->service->companyApprove($id);
    }

    public function companyReject(Request $request, string $id)
    {
        return $this->service->companyReject($request, $id);
    }
}
