import React from 'react';

const ExcelCell = ({ value, onChange, type = "number", ...props }) => (
  <input 
    type={type} 
    value={value ?? ""} 
    onChange={e => onChange?.(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
    className={`w-full h-8 px-2 border border-gray-300 text-sm ${props.readOnly ? "bg-gray-50" : "bg-white"} ${props.className || ""}`}
  />
);

const YesNoDropdown = ({ value, onChange, ...props }) => (
  <select 
    value={value || ""} 
    onChange={e => onChange?.(e.target.value)}
    className={`w-full h-8 px-2 border border-gray-300 text-sm bg-white ${props.className || ""}`}
  >
    <option value="">Select</option>
    <option value="Y">Y</option>
    <option value="N">N</option>
  </select>
);

function GridSheet({ section, config, data, onChange }) {
  return (
    <div className="p-4 bg-white">
      <div className="grid grid-cols-2 gap-1 text-sm max-w-xl">
        <div className="font-bold bg-blue-50 p-2 border col-span-2 capitalize">
          {section.replace(/([A-Z])/g, ' $1')} Sheet
        </div>
        {config.map(([label, key, type, special, condField, condValue]) =>
          special === "conditional" && data[condField] !== condValue ? null : (
            <React.Fragment key={key}>
              <div className="p-2 border">{label}</div>
              {type === "dropdown" ?
                <YesNoDropdown value={data[key]} onChange={v => onChange(section, key, v)} /> :
                <ExcelCell value={data[key]} type={type || "number"} onChange={v => onChange(section, key, v)} />
              }
            </React.Fragment>
          )
        )}
      </div>
    </div>
  );
}

export default GridSheet; 