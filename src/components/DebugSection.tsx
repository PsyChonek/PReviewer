import React from 'react';
import { useConfigStore } from '../store/configStore';

const DebugSection: React.FC = () => {
  const { debugMode, setDebugMode } = useConfigStore();
  return (
    <div>
      <h4 className="text-md font-semibold mb-3">Debug Options</h4>
      <div className="form-control">
        <label className="cursor-pointer label justify-between items-center">
          <span className="label-text font-medium">Enable Debug Logging</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
          />
        </label>
      </div>
    </div>
  );
};

export default DebugSection;