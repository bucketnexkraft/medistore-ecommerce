<?php

namespace App\Auth;

use Illuminate\Auth\EloquentUserProvider;

/**
 * JWT identity lookups must not be restricted by the storefront company scope.
 * Resource queries remain company-scoped after the authenticated user is known.
 */
class ApiUserProvider extends EloquentUserProvider
{
    protected function newModelQuery($model = null)
    {
        $query = is_null($model)
            ? $this->createModel()->newQueryWithoutScopes()
            : $model->newQueryWithoutScopes();

        with($query, $this->queryCallback);

        return $query;
    }
}
