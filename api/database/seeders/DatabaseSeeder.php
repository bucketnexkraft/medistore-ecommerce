<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            EcommerceCatalogSeeder::class,
            EcommerceDemoDataSeeder::class,
            MstoreEcommerceDataSeeder::class,
            DemoStoreEcommerceDataSeeder::class,
            LocationHierarchySeeder::class,
            BangladeshLocationSeeder::class,
        ]);
    }
}
