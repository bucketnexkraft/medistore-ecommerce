<?php

namespace App\Sections;

use App\Models\Section as SectionModel;

/**
 * This is the base class for all sections.
 * It defines the common properties and methods that all sections share.
 */
abstract class BaseSection
{
    /**
     * The name of the section.
     * @var string
     */
    protected string $name;

    /**
     * The title of the section.
     * @var string
     */
    protected string $title;

    /**
     * The keyword of the section.
     * @var string
     */
    protected string $keyword;

    /**
     * Whether the section has a repeater or not.
     * @var bool
     */
    protected bool $has_repeater;

    /**
     * The content of the section.
     * @var array
     */
    protected array $content = [];

    /**
     * The element of the section.
     * @var array
     */
    public array $element = [];

    /**
     * The model of the section.
     * @var SectionModel|null
     */
    protected ?SectionModel $model = null;

    /**
     * Constructor for the class.
     *
     * @param mixed $idOrContent The ID or content of the section.
     */
    public function __construct($idOrContent = null)
    {
        if (is_array($idOrContent)) {
            $this->content = $idOrContent;
        } elseif ($idOrContent) {
            $this->loadFromDatabase($idOrContent);
        }
    }

    /**
     * Load the section from the database.
     *
     * @param mixed $idOrName The ID or name of the section.
     */
    public function loadFromDatabase($idOrName)
    {
        $query = SectionModel::query();

        if (is_numeric($idOrName)) {
            $this->model = $query->find($idOrName);
        } else {
            $this->model = $query->where('name', $idOrName)->first();
        }

        if ($this->model) {
            $this->content = $this->model->content ?? [];
            $this->element = $this->model->element ?? [];
        }

        if (empty($this->content)) {
            $defaults = [];

            foreach (static::fields() as $field) {
                $onlyName = str_replace(['content[', ']'], '', $field->getName());

                $defaults[$onlyName] = '';
            }

            $this->content = array_merge($defaults, $this->content);
        }
    }

    /**
     * Returns the fields of the section.
     *
     * @return array An array of fields.
     */
    abstract public static function fields(): array;

    /**
     * Renders the section.
     *
     * @return string The rendered section.
     */
    abstract public function render(): string;

    /**
     * Checks if the section is fixed.
     *
     * @return bool Whether the section is fixed or not.
     */
    public static function isFixed(): bool
    {
        return false;
    }

    /**
     * Returns the model of the section.
     *
     * @return SectionModel|null The model of the section.
     */
    function getModel()
    {
        return $this->model;
    }

    /**
     * Returns the value of an element field.
     *
     * @param string $field The name of the field.
     * @param mixed $default The default value if the field is not found.
     * @param mixed $index The index of the element.
     * @return mixed The value of the field.
     */
    public function getElement(string $field, $default = null, $index = null)
    {
        preg_match('/\[([^\]]+)\]$/', $field, $matches);

        $onlyName = $matches[1] ?? $field;

        return $this->element[$index][$onlyName] ?? $default;
    }

    /**
     * Returns the value of a content field.
     *
     * @param string $field The name of the field.
     * @param mixed $default The default value if the field is not found.
     * @return mixed The value of the field.
     */
    public function getField(string $field, $default = null)
    {
        $onlyName = str_replace(['content[', ']'], '', $field);

        return $this->content[$onlyName] ?? $default;
    }

    /**
     * Returns the name of the section.
     *
     * @return string The name of the section.
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * Returns the title of the section.
     *
     * @return string The title of the section.
     */
    public function getTitle(): string
    {
        return $this->title;
    }

    /**
     * Returns the keyword of the section.
     *
     * @return string The keyword of the section.
     */
    public function getKeyword(): string
    {
        return $this->keyword;
    }

    /**
     * Checks if the section has a repeater.
     *
     * @return bool Whether the section has a repeater or not.
     */
    public function hasRepeater(): bool
    {
        return $this->has_repeater;
    }
}
