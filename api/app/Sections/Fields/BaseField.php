<?php 
namespace App\Sections\Fields;

abstract class BaseField
{
    protected string $name;
    protected string $label;
    protected $default;
    protected ?string $col = 'col-lg-3';
    protected ?array $validation = [];
    protected bool $multiple = false;

    public function __construct(string $name, string $label, $default = null, ?string $col = 'col-lg-3',bool $multiple = false, ?array $validation = [])
    {
        $this->name = $name;
        $this->label = $label;
        $this->default = $default;
        $this->col = $col;
        $this->validation = $validation;
        $this->multiple = $multiple;
    }

    abstract public function render($value = null): string;

    public function getValidation(){
        return $this->validation;
    }
    public function getMultiple(){
        return $this->multiple;
    }
    public function getCol(){
        return $this->col;
    }
    public function getName(){
        return $this->name;
    }
    public function getLabel(){
        return $this->label;
    }
    public function getDefault(){
        return $this->default;
    }
}
