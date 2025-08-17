import { useState } from "react";
import { Button } from "./ui/Button";
import { UsdaKeyDialog } from "./UsdaKeyDialog";

interface Props {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: Props) {
  const [showDialog, setShowDialog] = useState(false);

  const handleSaved = () => {
    setShowDialog(false);
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark p-4">
      <div className="bg-surface-card max-w-md w-full p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Welcome</h1>
        <p className="mb-4 text-sm">
          This app uses the USDA FoodData Central API to search for foods.
          You'll need your own API key to use this feature.
        </p>
        <a
          href="https://api.data.gov/signup/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-primary underline"
        >
          Request a USDA API Key
        </a>
        <div className="mt-6 text-right">
          <Button onClick={() => setShowDialog(true)}>I have a key</Button>
        </div>
      </div>
      {showDialog && <UsdaKeyDialog onSaved={handleSaved} />}
    </div>
  );
}

export default Onboarding;
