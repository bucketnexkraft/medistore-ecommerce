import React, { useState, useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";

const CategoryForm = ({
  isEdit = false,
  editableData = null,
  onSubmit,
  parentCategories = [],
  onCancel = () => {},
  showButton = true,
  isSuccess,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      title: "",
      image: null,
      status: 1,
      ancestor_id: null,
      is_show_in_category_header: 0,
      return_enabled: 0,
      return_day: "",
      return_condition: [{ value: "" }],
    },
  });
  const {
    fields: returnConditionFields,
    append: appendReturnCondition,
    remove: removeReturnCondition,
    replace: replaceReturnCondition,
  } = useFieldArray({
    control,
    name: "return_condition",
  });

  const [imagePreview, setImagePreview] = useState("");
  const [showParentCategories, setParentCategoriesVisibility] = useState(false);
  const [isCameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const status = watch("status");
  const showInHeader = watch("is_show_in_category_header");
  const returnEnabled = watch("return_enabled");

  const handleToggle = () => {
    setParentCategoriesVisibility((prev) => !prev);
  };

  useEffect(() => {
    if (isEdit && editableData) {
      reset({
        title: editableData.title || "",
        image: null,
        status: editableData.status ?? 1,
        ancestor_id: editableData.ancestor_id || null,
        is_show_in_category_header: editableData.is_show_in_category_header ? 1 : 0,
        return_enabled: editableData.return_enabled ? 1 : 0,
        return_day: editableData.return_day ?? "",
        return_condition:
          Array.isArray(editableData.return_condition) && editableData.return_condition.length > 0
            ? editableData.return_condition.map((item) => ({ value: item || "" }))
            : [{ value: "" }],
      });
      setParentCategoriesVisibility(!!editableData.ancestor_id);
      if (editableData.image) {
        setImagePreview(editableData.image);
      }
    }
  }, [isEdit, editableData, reset]);

  useEffect(() => {
    if (isSuccess) {
      reset({
        title: "",
        image: null,
        status: 1,
        ancestor_id: null,
        is_show_in_category_header: 0,
        return_enabled: 0,
        return_day: "",
        return_condition: [{ value: "" }],
      });
      setParentCategoriesVisibility(false);
      setImagePreview("");
    }
  }, [isSuccess, reset]);

  useEffect(() => {
    return () => stopCamera(); // Cleanup on unmount
  }, []);

  useEffect(() => {
    if (returnConditionFields.length === 0) {
      appendReturnCondition({ value: "" });
    }
  }, [appendReturnCondition, returnConditionFields.length]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue("image", file);
      setImagePreview(URL.createObjectURL(file));
      stopCamera();
    }
  };

  const handleStatusChange = (e) => {
    setValue("status", e.target.checked ? 1 : 0);
  };

  const handleShowInHeaderChange = (e) => {
    setValue("is_show_in_category_header", e.target.checked ? 1 : 0);
  };

  const handleReturnEnabledChange = (e) => {
    setValue("return_enabled", e.target.checked ? 1 : 0);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      // Wait for videoRef to be available
      const waitForVideoElement = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current
              .play()
              .then(() => {
                setCameraActive(true);
              })
              .catch((err) => {
                console.error("Error playing video:", err);
                setCameraError("Failed to play camera feed.");
                setCameraActive(false);
                stopCamera();
              });
          };
        } else {
          console.error("Video ref not found, retrying...");
          setTimeout(waitForVideoElement, 100);
        }
      };

      waitForVideoElement();
    } catch (error) {
      console.error("Error accessing camera:", error);
      setCameraError(
        "Unable to access camera. Please use file upload instead."
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraError(null);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      canvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], "captured-image.jpg", {
              type: "image/jpeg",
            });
            setValue("image", file);
            setImagePreview(URL.createObjectURL(file));
            stopCamera();
          } else {
            setCameraError("Failed to capture image.");
            console.error("No blob returned from canvas");
          }
        },
        "image/jpeg",
        0.95
      );
    } else {
      console.error("Video or canvas ref not available");
      setCameraError("Cannot capture image: video or canvas not available.");
    }
  };

  const onFormSubmit = async (data) => {
    if (!showParentCategories) {
      data.ancestor_id = null;
    }
    try {
      await onSubmit(data);
      //   reset({
      //     title: "",
      //     image: null,
      //     status: 1,
      //     ancestor_id: null,
      //   });
      //   setImagePreview("");
      //   stopCamera();
      //   closeModal("add_edit_category_modal");
    } catch (error) {
      console.error("Form submission error:", error);
      throw error; // Let parent component handle errors
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      <div className="grid gap-4">
        {/* Parent Category Selector */}
        <div className="form-control w-fit flex flex-row items-center gap-3">
          <label htmlFor="hasParent" className="label cursor-pointer">
            <span className="label-text font-medium text-sm">Has Parent</span>
          </label>
          <input
            type="checkbox"
            id="hasParent"
            className="toggle toggle-primary "
            checked={showParentCategories}
            onChange={handleToggle}
          />
        </div>
        {showParentCategories && (
          <div className="form-control">
            <label className="label" htmlFor="ancestor_id">
              <span className="label-text">Parent Category</span>
            </label>
            <select
              id="ancestor_id"
              {...register("ancestor_id")}
              className="select select-bordered w-full"
            >
              <option value="">No Parent Category</option>
              {parentCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title Field */}
        <div className="form-control">
          <label className="label" htmlFor="title">
            <span className="label-text">Title</span>
          </label>
          <input
            type="text"
            id="title"
            {...register("title", {
              required: "Title is required",
              maxLength: {
                value: 255,
                message: "Title must be at most 255 characters long",
              },
            })}
            className={`input input-bordered ${
              errors.title ? "input-error" : ""
            }`}
            placeholder="Enter category title"
          />
          {errors.title && (
            <label className="label">
              <span className="label-text-alt text-error">
                {errors.title.message}
              </span>
            </label>
          )}
        </div>

        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-4">
            <input
              type="checkbox"
              checked={returnEnabled === 1}
              onChange={handleReturnEnabledChange}
              className="toggle toggle-primary"
            />
            <span className="label-text">Return Enabled</span>
          </label>
          <p className="text-xs text-gray-500">
            Enable this category-specific return rule.
          </p>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="return_day">
            <span className="label-text">Return Day</span>
          </label>
          <input
            type="number"
            min="0"
            id="return_day"
            {...register("return_day")}
            className="input input-bordered"
            placeholder="e.g. 7"
          />
        </div>

        <div className="form-control">
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="return_condition_0">
              <span className="label-text">Return Conditions</span>
            </label>
            <button
              type="button"
              onClick={() => appendReturnCondition({ value: "" })}
              className="btn btn-sm btn-outline"
            >
              Add Field
            </button>
          </div>
          <div className="space-y-2">
            {returnConditionFields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <input
                  id={`return_condition_${index}`}
                  type="text"
                  {...register(`return_condition.${index}.value`)}
                  className="input input-bordered flex-1"
                  placeholder={`Return condition ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    returnConditionFields.length > 1
                      ? removeReturnCondition(index)
                      : replaceReturnCondition([{ value: "" }])
                  }
                  className="btn btn-outline btn-error"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Image Field */}
        <div className="form-control">
          <label className="label" htmlFor="image">
            <span className="label-text">Image</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              id="image"
              onChange={handleImageChange}
              className="file-input file-input-bordered w-full"
              accept="image/*"
            />
            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCamera}
              className="btn btn-square btn-outline"
              title={isCameraActive ? "Stop Camera" : "Use Camera"}
            >
              {isCameraActive ? "🛑" : "📷"}
            </button>
          </div>
          {cameraError && <div className="mt-2 text-error">{cameraError}</div>}
          <div className="mt-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-w-xs rounded border border-gray-300"
              style={{
                width: "100%",
                maxWidth: "300px",
                display: isCameraActive ? "block" : "none",
              }}
            />
            {isCameraActive && (
              <button
                type="button"
                onClick={captureImage}
                className="btn btn-primary mt-2"
              >
                Capture Image
              </button>
            )}
          </div>
          {imagePreview && (
            <div className="mt-2">
              <div className="avatar">
                <div className="w-24 h-24 rounded">
                  <img src={imagePreview} alt="Preview" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Field */}
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-4">
            <input
              type="checkbox"
              checked={showInHeader === 1}
              onChange={handleShowInHeaderChange}
              className="toggle toggle-primary"
            />
            <span className="label-text">Show In Category Header</span>
          </label>
          <p className="text-xs text-gray-500">
            Enable this to show the category in storefront header and hot category sections.
          </p>
        </div>

        {/* Status Field */}
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-4">
            <input
              type="checkbox"
              checked={status === 1}
              onChange={handleStatusChange}
              className="toggle toggle-primary"
            />
            <span className="label-text">Active</span>
          </label>
        </div>
      </div>

      {showButton && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset({
                title: "",
                image: null,
                status: 1,
                ancestor_id: null,
                is_show_in_category_header: 0,
                return_enabled: 0,
                return_day: "",
                return_condition: [{ value: "" }],
              });
              setImagePreview("");
              stopCamera();
              onCancel();
            }}
            className="btn btn-ghost"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`btn btn-primary ${isSubmitting ? "loading" : ""}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing..." : isEdit ? "Update" : "Save"}
          </button>
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </form>
  );
};

export default CategoryForm;
