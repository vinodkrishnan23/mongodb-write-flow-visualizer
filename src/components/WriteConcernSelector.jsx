import React from 'react';

const options = [
  { value: 'w0', label: 'w:0', className: 'wc-w0' },
  { value: 'w1', label: 'w:1', className: 'wc-w1' },
  { value: 'wmajority', label: 'w:"majority"', className: 'wc-wmajority' }
];

export default function WriteConcernSelector({ selected, onChange }) {
  return (
    <div className="wc-selector" role="tablist" aria-label="Write concern selector">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`wc-tab ${option.className} ${selected === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
