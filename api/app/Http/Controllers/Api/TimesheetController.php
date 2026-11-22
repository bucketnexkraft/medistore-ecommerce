<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Timesheet\CashHandoverRequest;
use App\Http\Requests\Api\Timesheet\CurrentShiftRequest;
use App\Http\Requests\Api\Timesheet\GetUsersRequest;
use App\Http\Requests\Api\Timesheet\HandoverShiftRequest;
use App\Http\Requests\Api\Timesheet\StartShiftRequest;
use App\Services\Api\TimesheetService;

class TimesheetController extends Controller
{
    public function __construct(private readonly TimesheetService $service)
    {
    }

    public function getUsers(GetUsersRequest $request)
    {
        return response()->json($this->service->getUsers(), 200);
    }

    public function currentShift(CurrentShiftRequest $request)
    {
        return response()->json($this->service->currentShift(), 200);
    }

    public function startShift(StartShiftRequest $request)
    {
        [$payload, $status] = $this->service->startShift($request);
        return response()->json($payload, $status);
    }

    public function closeSummary(CurrentShiftRequest $request)
    {
        [$payload, $status] = $this->service->closeSummary();
        return response()->json($payload, $status);
    }

    public function handoverShift(HandoverShiftRequest $request)
    {
        [$payload, $status] = $this->service->handoverShift($request);
        return response()->json($payload, $status);
    }

    public function cashHandover(CashHandoverRequest $request)
    {
        [$payload, $status] = $this->service->cashHandover($request);
        return response()->json($payload, $status);
    }
}
