<?php

use App\Http\Controllers\InstallerController;
use Illuminate\Support\Facades\Route;

Route::middleware('is_already_installed')->controller(InstallerController::class)->group(function () {
    Route::get('/install', 'welcome')->name('installer.welcome');
    Route::get('/install/requirements', 'checkRequirements')->name('installer.requirements');
    Route::get('/install/permissions', 'checkPermissions')->name('installer.permissions');
    Route::get('/install/database', 'showDatabaseForm')->name('installer.database');
    Route::post('/install/database', 'saveDatabaseSettings')->name('installer.database.save');
    Route::get('/install/admin', 'showAdminForm')->name('installer.admin');
    Route::post('/install/process', 'processInstallation')->name('installer.process');
});
