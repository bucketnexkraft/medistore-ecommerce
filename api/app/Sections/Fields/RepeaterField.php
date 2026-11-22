<?php

namespace App\Sections\Fields;

class RepeaterField extends BaseField
{
    protected array $fields = [];

    public function __construct(string $name, array $fields, string $label = '')
    {
        $this->name = $name;
        $this->label = $label ?: ucfirst($name);
        $this->fields = $fields;
    }

    public function render($values = []): string
    {
        return view('components.input.repeater', [
            'name' => $this->name,
            'label' => $this->label,
            'fields' => $this->fields,
            'values' => $values,
        ])->render();
    }
}
