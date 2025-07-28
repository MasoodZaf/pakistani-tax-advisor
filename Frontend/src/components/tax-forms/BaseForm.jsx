import React from 'react';
import { useFormik } from 'formik';
import { CircularProgress } from '@mui/material';
import { useTaxForm } from '../../context/TaxFormContext';

const BaseForm = ({
  initialValues,
  validationSchema,
  onSubmit,
  formFields,
  title,
  formType,
  formId = null,
  loading: externalLoading = false,
  error: externalError = null,
}) => {
  const {
    loading: contextLoading,
    error: contextError,
    taxYears,
    employers,
    loadTaxYears,
    loadEmployers,
    saveForm,
    loadForm,
  } = useTaxForm();

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    loadTaxYears();
    if (formFields.some(field => field.name === 'employer_id')) {
      loadEmployers();
    }
    if (formId) {
      loadFormData();
    }
  }, [formId, loadTaxYears, loadEmployers, formFields]);

  const loadFormData = async () => {
    try {
      const data = await loadForm(formType, formId);
      formik.setValues(data);
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  };

  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        if (onSubmit) {
          await onSubmit(values);
        } else {
          await saveForm(formType, values, formId);
        }
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const renderField = (field) => {
    const { name, label, type = 'text', options } = field;
    const value = formik.values[name];
    const error = formik.touched[name] && formik.errors[name];

    switch (type) {
      case 'select':
        return (
          <select
            id={name}
            name={name}
            value={value || ''}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="input"
          >
            <option value="">Select {label}</option>
            {options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea
            id={name}
            name={name}
            value={value || ''}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="input h-32"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            id={name}
            name={name}
            value={value || ''}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="input"
          />
        );
      default:
        return (
          <input
            type={type}
            id={name}
            name={name}
            value={value || ''}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="input"
          />
        );
    }
  };

  const groupedFields = formFields.reduce((acc, field) => {
    const section = field.section || 'default';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {});

  if (externalLoading || contextLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircularProgress sx={{ color: '#00A651' }} />
      </div>
    );
  }

  const error = externalError || contextError;

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">{title}</h2>
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}
      <form onSubmit={formik.handleSubmit} className="space-y-6">
        {Object.entries(groupedFields).map(([section, fields]) => (
          <div key={section} className="space-y-4">
            {section !== 'default' && (
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
                {section}
              </h3>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.name}>
                  <label htmlFor={field.name} className="label">
                    {field.label}
                  </label>
                  {renderField(field)}
                  {formik.touched[field.name] && formik.errors[field.name] && (
                    <div className="text-red-500 text-sm mt-1">
                      {formik.errors[field.name]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BaseForm; 