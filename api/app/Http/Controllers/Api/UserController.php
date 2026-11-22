<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\UserControllerService;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(private readonly UserControllerService $service) {}

    public function list(Request $request)
    {
        return $this->service->list($request);
    }

    public function store(Request $request)
    {
        return $this->service->store($request);
    }

    public function update(Request $request, $id)
    {
        return $this->service->update($request, $id);
    }

    public function updateStatus(Request $request)
    {
        return $this->service->updateStatus($request);
    }

    public function delete(Request $request, $id = null)
    {
        return $this->service->delete($request, $id);
    }

    public function destroyMultiple(Request $request)
    {
        return $this->service->destroyMultiple($request);
    }

    public function partnerList()
    {
        return $this->service->partnerList();
    }

    public function searchCustomers(Request $request)
    {
        return $this->service->searchCustomers($request);
    }

    public function customerStore(Request $request)
    {
        return $this->service->customerStore($request);
    }

    public function getDefaultCustomer()
    {
        return $this->service->getDefaultCustomer();
    }
}
