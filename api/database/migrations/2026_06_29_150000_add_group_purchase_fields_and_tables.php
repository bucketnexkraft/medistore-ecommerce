<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product', function (Blueprint $table) {
            if (! Schema::hasColumn('product', 'is_group_purchase_available')) {
                $table->boolean('is_group_purchase_available')->default(false)->after('is_bundle');
            }

            if (! Schema::hasColumn('product', 'group_purchase_discount_type')) {
                $table->enum('group_purchase_discount_type', ['fixed', 'percent'])
                    ->nullable()
                    ->after('is_group_purchase_available');
            }

            if (! Schema::hasColumn('product', 'group_purchase_minimum_user')) {
                $table->unsignedInteger('group_purchase_minimum_user')
                    ->nullable()
                    ->after('group_purchase_discount_type');
            }

            if (! Schema::hasColumn('product', 'group_purchase_discount_amount')) {
                $table->decimal('group_purchase_discount_amount', 10, 2)
                    ->nullable()
                    ->after('group_purchase_minimum_user');
            }
        });

        Schema::create('group_purchases', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id')->nullable()->index();
            $table->string('product_id')->index();
            $table->string('owner_user_id')->index();
            $table->string('share_token', 80)->unique();
            $table->enum('status', ['open', 'completed', 'cancelled'])->default('open')->index();
            $table->unsignedInteger('minimum_users');
            $table->enum('discount_type', ['fixed', 'percent']);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('base_price', 10, 2)->default(0);
            $table->decimal('discounted_price', 10, 2)->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
        });

        Schema::create('group_purchase_members', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('group_purchase_id')->index();
            $table->string('user_id')->index();
            $table->enum('status', ['joined', 'left'])->default('joined');
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->unique(['group_purchase_id', 'user_id'], 'group_purchase_members_unique');
        });

        Schema::create('group_purchase_messages', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('group_purchase_id')->index();
            $table->string('user_id')->index();
            $table->text('message');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_purchase_messages');
        Schema::dropIfExists('group_purchase_members');
        Schema::dropIfExists('group_purchases');

        Schema::table('product', function (Blueprint $table) {
            $columns = [
                'is_group_purchase_available',
                'group_purchase_discount_type',
                'group_purchase_minimum_user',
                'group_purchase_discount_amount',
            ];

            $existing = array_values(array_filter($columns, fn (string $column) => Schema::hasColumn('product', $column)));

            if ($existing !== []) {
                $table->dropColumn($existing);
            }
        });
    }
};
