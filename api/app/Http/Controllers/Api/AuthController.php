<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\Api\AuthService;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $service)
    {
    }

    public function login(Request $request)
    {
        return $this->service->login($request);
    }

    public function registerCompany(Request $request)
    {
        return $this->service->registerCompany($request);
    }

    public function registerCustomer(Request $request)
    {
        return $this->service->registerCustomer($request);
    }

    public function googleRedirect(Request $request)
    {
        return $this->service->googleRedirect($request);
    }

    public function googleCallback(Request $request)
    {
        return $this->service->googleCallback($request);
    }

    public function forgotPasswordRequest(Request $request)
    {
        return $this->service->forgotPasswordRequest($request);
    }

    public function forgotPasswordVerify(Request $request)
    {
        return $this->service->forgotPasswordVerify($request);
    }

    public function forgotPasswordReset(Request $request)
    {
        return $this->service->forgotPasswordReset($request);
    }

    public function me()
    {
        return $this->service->me();
    }

    public function getUserRights()
    {
        return $this->service->getUserRights();
    }

    public function updateProfile(Request $request)
    {
        return $this->service->updateProfile($request);
    }

    public function changePassword(Request $request)
    {
        return $this->service->changePassword($request);
    }

    public function logout()
    {
        return $this->service->logout();
    }

    public function verifyToken()
    {
        return $this->service->verifyToken();
    }

    public function verifyRouteAccess(Request $request)
    {
        return $this->service->verifyRouteAccess($request);
    }

    public function issueAdminTransferCode(Request $request)
    {
        return $this->service->issueAdminTransferCode($request);
    }

    public function consumeAdminTransferCode(Request $request)
    {
        return $this->service->consumeAdminTransferCode($request);
    }

    public function issueLandingTransferCode(Request $request)
    {
        return $this->service->issueLandingTransferCode($request);
    }

    public function consumeLandingTransferCode(Request $request)
    {
        return $this->service->consumeLandingTransferCode($request);
    }
}
