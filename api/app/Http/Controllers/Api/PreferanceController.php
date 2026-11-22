<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Preferance\CustomDataRequest;
use App\Http\Requests\Api\Preferance\GetCompanyPreferencesRequest;
use App\Http\Requests\Api\Preferance\GetCurrencyRequest;
use App\Http\Requests\Api\Preferance\PreferencesRequest;
use App\Http\Requests\Api\Preferance\UpdateCompanyPreferencesRequest;
use App\Http\Requests\Api\Preferance\UpdatePreferencesRequest;
use App\Services\Api\PreferanceService;
use Illuminate\Http\Request;

class PreferanceController extends Controller
{
    public function __construct(private readonly PreferanceService $service)
    {
    }
    public function preferences(PreferencesRequest $request)
    {
        return $this->service->preferences($request);
    }

    /**
     * Update company preferences
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */

    public function updateCompanyPreferences(UpdateCompanyPreferencesRequest $request)
    {
        return $this->service->updateCompanyPreferences($request);
    }

    /**
     * Update preferences
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updatePreferences(UpdatePreferencesRequest $request)
    {
        return $this->service->updatePreferences($request);
    }


    public function customData(CustomDataRequest $request)
    {
        return $this->service->customData();
    }

    public function getCompanyPreferences(GetCompanyPreferencesRequest $request)
    {   
        return $this->service->getCompanyPreferences();
    }

    public function getCurrency(GetCurrencyRequest $request)
    {
        return $this->service->getCurrency();
    }

    public function geoLocations()
    {
        return $this->service->geoLocations();
    }

    public function sendTestSms(\Illuminate\Http\Request $request)
    {
        return $this->service->sendTestSms($request);
    }

    public function sendTestPathaoCourier(Request $request)
    {
        return $this->service->sendTestPathaoCourier($request);
    }
}
