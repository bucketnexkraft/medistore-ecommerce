<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\LocationHierarchy;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class BangladeshLocationSeeder extends Seeder
{
    private const GEO_API_BASE_URL = 'https://bdapis.pro.bd/geo/v2.0';

    public function run(): void
    {
        $countryHierarchy = $this->requireHierarchy('country');
        $divisionHierarchy = $this->requireHierarchy('division');
        $districtHierarchy = $this->requireHierarchy('district');
        $upazilaHierarchy = $this->requireHierarchy('upazila-thana', 'Upazila/Thana');

        $country = $this->upsertLocation(
            hierarchyId: $countryHierarchy->id,
            parentId: null,
            name: 'Bangladesh',
            meta: [
                'country_code' => 'BD',
                'source' => 'manual',
            ],
        );

        $divisions = $this->fetchGeoCollection('/divisions');
        $districts = $this->fetchGeoCollection('/districts');
        $upazilas = $this->fetchGeoCollection('/upazilas');

        $divisionMap = [];
        foreach ($divisions as $divisionRow) {
            $division = $this->upsertLocation(
                hierarchyId: $divisionHierarchy->id,
                parentId: $country->id,
                name: (string) $divisionRow['name'],
                meta: [
                    'source' => 'bdapis.pro.bd',
                    'source_id' => $divisionRow['id'],
                    'name_bn' => $divisionRow['name_bn'],
                ],
            );

            $divisionMap[(string) $divisionRow['id']] = $division;
        }

        $districtMap = [];
        foreach ($districts as $districtRow) {
            $divisionSourceId = (string) ($districtRow['division_id'] ?? '');
            $division = $divisionMap[$divisionSourceId] ?? null;

            if (! $division) {
                continue;
            }

            $district = $this->upsertLocation(
                hierarchyId: $districtHierarchy->id,
                parentId: $division->id,
                name: (string) $districtRow['name'],
                meta: [
                    'source' => 'bdapis.pro.bd',
                    'source_id' => $districtRow['id'],
                    'source_division_id' => $divisionSourceId !== '' ? $divisionSourceId : null,
                    'name_bn' => $districtRow['name_bn'],
                ],
            );

            $districtMap[(string) $districtRow['id']] = $district;
        }

        foreach ($upazilas as $upazilaRow) {
            $districtSourceId = (string) ($upazilaRow['district_id'] ?? '');
            $district = $districtMap[$districtSourceId] ?? null;

            if (! $district) {
                continue;
            }

            $this->upsertLocation(
                hierarchyId: $upazilaHierarchy->id,
                parentId: $district->id,
                name: (string) $upazilaRow['name'],
                meta: [
                    'source' => 'bdapis.pro.bd',
                    'source_id' => $upazilaRow['id'],
                    'source_district_id' => $districtSourceId !== '' ? $districtSourceId : null,
                    'name_bn' => $upazilaRow['name_bn'],
                ],
            );
        }
    }

    private function requireHierarchy(string $slug, ?string $name = null): LocationHierarchy
    {
        $hierarchy = LocationHierarchy::query()
            ->where('slug', $slug)
            ->when($name, fn ($query) => $query->orWhere('name', $name)->orWhere('slug', Str::slug($name)))
            ->first();

        if (! $hierarchy) {
            throw new \RuntimeException("Required location hierarchy [{$slug}] was not found. Run LocationHierarchySeeder first.");
        }

        return $hierarchy;
    }

    private function fetchGeoCollection(string $path): array
    {
        $response = Http::timeout(30)
            ->retry(2, 500)
            ->acceptJson()
            ->get(self::GEO_API_BASE_URL . $path);

        if (! $response->successful()) {
            throw new \RuntimeException("Bangladesh geo API request failed for [{$path}] with status {$response->status()}.");
        }

        $payload = $response->json();
        $items = is_array($payload['data'] ?? null)
            ? $payload['data']
            : (is_array($payload) ? $payload : []);

        return collect($items)
            ->map(fn ($row) => [
                'id' => isset($row['id']) ? (string) $row['id'] : null,
                'name' => isset($row['name']) ? trim((string) $row['name']) : null,
                'name_bn' => isset($row['bn_name']) ? trim((string) $row['bn_name']) : null,
                'division_id' => isset($row['division_id']) ? (string) $row['division_id'] : null,
                'district_id' => isset($row['district_id']) ? (string) $row['district_id'] : null,
            ])
            ->filter(fn ($row) => ! empty($row['id']) && ! empty($row['name']))
            ->values()
            ->all();
    }

    private function upsertLocation(int $hierarchyId, ?int $parentId, string $name, array $meta = []): Location
    {
        $slug = Str::slug($name);

        return Location::query()->updateOrCreate(
            [
                'location_hierarchy_id' => $hierarchyId,
                'parent_id' => $parentId,
                'slug' => $slug,
            ],
            [
                'name' => $name,
                'status' => true,
                'meta' => $meta,
            ]
        );
    }
}
