-- Insert sample organizations (employers)
INSERT INTO organizations (
    name,
    registration_number,
    tax_identification_number,
    organization_type,
    address,
    contact_info,
    is_active
) VALUES 
(
    'Tech Solutions Pakistan',
    'REG-001-2024',
    'TIN-001-2024',
    'private_company',
    '{"street": "Plot 123, Blue Area", "city": "Islamabad", "province": "ICT", "postal_code": "44000", "country": "Pakistan"}'::jsonb,
    '{"phone": "+92-51-1234567", "email": "info@techsolutions.pk", "website": "www.techsolutions.pk"}'::jsonb,
    true
),
(
    'Global Systems Ltd',
    'REG-002-2024',
    'TIN-002-2024',
    'private_company',
    '{"street": "Office 45, Clifton", "city": "Karachi", "province": "Sindh", "postal_code": "75600", "country": "Pakistan"}'::jsonb,
    '{"phone": "+92-21-9876543", "email": "contact@globalsystems.pk", "website": "www.globalsystems.pk"}'::jsonb,
    true
),
(
    'Innovative Solutions',
    'REG-003-2024',
    'TIN-003-2024',
    'private_company',
    '{"street": "88-B1, Gulberg III", "city": "Lahore", "province": "Punjab", "postal_code": "54000", "country": "Pakistan"}'::jsonb,
    '{"phone": "+92-42-3456789", "email": "info@innovative.pk", "website": "www.innovative.pk"}'::jsonb,
    true
),
(
    'Pakistan State Oil',
    'REG-004-2024',
    'TIN-004-2024',
    'public_company',
    '{"street": "PSO House, Clifton", "city": "Karachi", "province": "Sindh", "postal_code": "75600", "country": "Pakistan"}'::jsonb,
    '{"phone": "+92-21-111-111-PSO", "email": "info@psopk.com", "website": "www.psopk.com"}'::jsonb,
    true
),
(
    'National Bank of Pakistan',
    'REG-005-2024',
    'TIN-005-2024',
    'public_company',
    '{"street": "NBP Building, I.I. Chundrigar Road", "city": "Karachi", "province": "Sindh", "postal_code": "74000", "country": "Pakistan"}'::jsonb,
    '{"phone": "+92-21-9062000", "email": "info@nbp.com.pk", "website": "www.nbp.com.pk"}'::jsonb,
    true
); 