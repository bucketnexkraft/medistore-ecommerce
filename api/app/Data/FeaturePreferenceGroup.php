<?php

namespace App\Data;

enum FeaturePreferenceGroup: string
{
    case WORKSPACE_ACCESS = 'workspace_access';
    case PRODUCT_CATALOG = 'product_catalog';
    case INVENTORY_WAREHOUSE = 'inventory_warehouse';
    case POS_SALES = 'pos_sales';
    case STOREFRONT_CHECKOUT = 'storefront_checkout';
    case ORDERS_CUSTOMER_SERVICE = 'orders_customer_service';
    case MARKETING_LOYALTY = 'marketing_loyalty';
    case REPORTS_INSIGHTS = 'reports_insights';

    public function label(): string
    {
        return match ($this) {
            self::WORKSPACE_ACCESS => 'Workspace & Access',
            self::PRODUCT_CATALOG => 'Products & Catalog',
            self::INVENTORY_WAREHOUSE => 'Stock & Warehouses',
            self::POS_SALES => 'POS & Sales',
            self::STOREFRONT_CHECKOUT => 'Storefront & Checkout',
            self::ORDERS_CUSTOMER_SERVICE => 'Orders & Customer Service',
            self::MARKETING_LOYALTY => 'Marketing & Loyalty',
            self::REPORTS_INSIGHTS => 'Reports & Insights',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::WORKSPACE_ACCESS => 'Company settings, roles, and protected workspace access.',
            self::PRODUCT_CATALOG => 'Product structure, merchandising, units, and catalog tools.',
            self::INVENTORY_WAREHOUSE => 'Stock control, warehouse movement, and inventory safeguards.',
            self::POS_SALES => 'Point-of-sale setup, selling workflows, quotations, and shifts.',
            self::STOREFRONT_CHECKOUT => 'Online storefront, customer sign-in, delivery, and payments.',
            self::ORDERS_CUSTOMER_SERVICE => 'Order lifecycle, returns, refunds, payouts, and waitlists.',
            self::MARKETING_LOYALTY => 'Promotions, rewards, referrals, demand tags, and email.',
            self::REPORTS_INSIGHTS => 'Product sales performance and decision-making reports.',
        };
    }

    public function order(): int
    {
        return match ($this) {
            self::WORKSPACE_ACCESS => 10,
            self::PRODUCT_CATALOG => 20,
            self::INVENTORY_WAREHOUSE => 30,
            self::POS_SALES => 40,
            self::STOREFRONT_CHECKOUT => 50,
            self::ORDERS_CUSTOMER_SERVICE => 60,
            self::MARKETING_LOYALTY => 70,
            self::REPORTS_INSIGHTS => 80,
        };
    }

    public function toArray(): array
    {
        return [
            'code' => $this->value,
            'name' => $this->label(),
            'description' => $this->description(),
            'order' => $this->order(),
        ];
    }

    public static function options(): array
    {
        return array_map(
            static fn (self $group) => $group->toArray(),
            self::cases()
        );
    }
}
