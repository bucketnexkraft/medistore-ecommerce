<?php

namespace Database\Seeders;

use App\Models\LocationHierarchy;
use Illuminate\Database\Seeder;

class LocationHierarchySeeder extends Seeder
{
    public function run(): void
    {
        $country = LocationHierarchy::query()->updateOrCreate(
            ['slug' => 'country'],
            [
                'name' => 'Country',
                'parent_hierarchy_id' => null,
                'status' => true,
            ]
        );

        $division = LocationHierarchy::query()->updateOrCreate(
            ['slug' => 'division'],
            [
                'name' => 'Division',
                'parent_hierarchy_id' => $country->id,
                'status' => true,
            ]
        );

        $district = LocationHierarchy::query()->updateOrCreate(
            ['slug' => 'district'],
            [
                'name' => 'District',
                'parent_hierarchy_id' => $division->id,
                'status' => true,
            ]
        );

        LocationHierarchy::query()->updateOrCreate(
            ['name' => 'Upazila/Thana'],
            [
                'name' => 'Upazila/Thana',
                'parent_hierarchy_id' => $district->id,
                'status' => true,
            ]
        );
    }
}
