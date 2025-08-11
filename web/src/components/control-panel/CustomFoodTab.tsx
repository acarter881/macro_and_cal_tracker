import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from 'react-hot-toast';
import { useStore } from "../../store";
import * as api from "../../api";
import type { LabelUnit, SimpleFood } from "../../types";

function toSimpleFood(f: any): SimpleFood {
  return {
    fdcId: f.fdc_id ?? f.fdcId, description: f.description ?? "",
    brandOwner: f.brand_owner ?? f.brandOwner ?? undefined,
    dataType: f.data_type ?? f.dataType ?? undefined,
  };
}

type CustomFoodFormData = {
  description: string; brand_owner: string;
  kcal_per_100g: number | ''; protein_g_per_100g: number | ''; carb_g_per_100g: number | ''; fat_g_per_100g: number | '';
  labelKcal: number | ''; labelP: number | ''; labelC: number | ''; labelF: number | ''; servAmt: number | '';
  servUnit: LabelUnit; density: number | '';
};

export function CustomFoodTab() {
  const { allMyFoods, setAllMyFoods } = useStore();
  const { register, handleSubmit, formState: { errors, isValid }, watch, setValue, reset } = useForm<CustomFoodFormData>({
    mode: 'onChange',
    defaultValues: {
      density: 1, servUnit: 'g', description: '', brand_owner: '',
      kcal_per_100g: '', protein_g_per_100g: '', carb_g_per_100g: '', fat_g_per_100g: '',
      labelKcal: '', labelP: '', labelC: '', labelF: '', servAmt: ''
    }
  });
  const [isCreatingFood, setIsCreatingFood] = useState(false);
  const [useLabel, setUseLabel] = useState(false);

  function toGrams(amount: number, unit: LabelUnit, dens: number) {
    switch (unit) {
      case 'g': return amount; case 'ml': return amount * dens;
      case 'oz': return amount * 28.3495; case 'fl oz': return amount * 29.5735 * dens;
      case 'cup': return amount * 240 * dens; case 'tbsp': return amount * 15 * dens;
      case 'tsp': return amount * 5 * dens; default: return NaN;
    }
  }

  const watchedConverterFields = watch(["labelKcal", "labelP", "labelC", "labelF", "servAmt", "servUnit", "density"]);
  const servUnit = watch("servUnit");

  const labelPer100 = useMemo(() => {
    const [labelKcal, labelP, labelC, labelF, servAmt, servUnit, density] = watchedConverterFields;
    const [_k, _p, _c, _f, _amt, _dens] = [labelKcal, labelP, labelC, labelF, servAmt, density].map(v => v === '' ? NaN : Number(v));
    if ([_k, _p, _c, _f, _amt].some(isNaN) || !_amt || _amt <= 0) return null;
    const grams = toGrams(Number(_amt), servUnit, Number(_dens || 1));
    if (!grams || isNaN(grams)) return null;
    const factor = 100 / grams;
    return { kcal: _k * factor, protein: _p * factor, carb: _c * factor, fat: _f * factor };
  }, [watchedConverterFields]);

  function applyConverterValues() {
    if (!labelPer100) return;
    setValue("kcal_per_100g", parseFloat(labelPer100.kcal.toFixed(2)), { shouldValidate: true });
    setValue("protein_g_per_100g", parseFloat(labelPer100.protein.toFixed(2)), { shouldValidate: true });
    setValue("carb_g_per_100g", parseFloat(labelPer100.carb.toFixed(2)), { shouldValidate: true });
    setValue("fat_g_per_100g", parseFloat(labelPer100.fat.toFixed(2)), { shouldValidate: true });
  }

  const onCreateCustomFood = async (data: CustomFoodFormData) => {
    setIsCreatingFood(true);
    try {
      const payload = { ...data, kcal_per_100g: Number(data.kcal_per_100g) || 0, protein_g_per_100g: Number(data.protein_g_per_100g) || 0, carb_g_per_100g: Number(data.carb_g_per_100g) || 0, fat_g_per_100g: Number(data.fat_g_per_100g) || 0 };
      const created = await api.createCustomFood(payload);
      setAllMyFoods([toSimpleFood(created), ...allMyFoods]);
      reset();
      toast.success('Custom food created!');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to create food.");
    } finally {
      setIsCreatingFood(false);
    }
  };

  const ids = {
    labelKcal: "conv-labelKcal",
    labelP: "conv-labelP",
    labelF: "conv-labelF",
    labelC: "conv-labelC",
    servAmt: "conv-servAmt",
    servUnit: "conv-servUnit",
    density: "conv-density",
    description: "cf-description",
    brand: "cf-brand",
    kcal: "cf-kcal",
    protein: "cf-protein",
    fat: "cf-fat",
    carb: "cf-carb"
  } as const;

  return (
    <form onSubmit={handleSubmit(onCreateCustomFood)} className="space-y-4">
      <div className="border-b border-border-light pb-4 dark:border-border-dark">
        <button type="button" className="text-sm font-medium text-brand-primary dark:text-brand-primary hover:underline" onClick={() => setUseLabel(v => !v)}>
          {useLabel ? '⏷ Hide Converter' : '⏵ Convert from a nutrition label'}
        </button>
        {useLabel && (
          <div className="mt-2 p-3 border border-border-light rounded-md bg-surface-light dark:bg-border-dark/50 dark:border-border-dark space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col">
                <label htmlFor={ids.labelKcal} className="sr-only">kcal per serving</label>
                <input id={ids.labelKcal} className="form-input" type="number" step="0.01" placeholder="kcal / serv" {...register('labelKcal', { valueAsNumber: true })} />
              </div>
              <div className="flex flex-col">
                <label htmlFor={ids.labelP} className="sr-only">protein grams</label>
                <input id={ids.labelP} className="form-input" type="number" step="0.01" placeholder="protein g" {...register('labelP', { valueAsNumber: true })} />
              </div>
              <div className="flex flex-col">
                <label htmlFor={ids.labelF} className="sr-only">fat grams</label>
                <input id={ids.labelF} className="form-input" type="number" step="0.01" placeholder="fat g" {...register('labelF', { valueAsNumber: true })} />
              </div>
              <div className="flex flex-col">
                <label htmlFor={ids.labelC} className="sr-only">carb grams</label>
                <input id={ids.labelC} className="form-input" type="number" step="0.01" placeholder="carb g" {...register('labelC', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">per</span>
              <div className="flex flex-col">
                <label htmlFor={ids.servAmt} className="sr-only">Serving size</label>
                <input id={ids.servAmt} className="form-input w-24" type="number" min={0} step="0.01" placeholder="Serv size" {...register('servAmt', { valueAsNumber: true })} />
              </div>
              <div className="flex flex-col flex-1">
                <label htmlFor={ids.servUnit} className="sr-only">Serving unit</label>
                <select id={ids.servUnit} className="form-input flex-1" {...register('servUnit')}>
                  <option value="g">g</option><option value="ml">ml</option><option value="oz">oz</option><option value="fl oz">fl oz</option><option value="cup">cup</option><option value="tbsp">tbsp</option><option value="tsp">tsp</option>
                </select>
              </div>
            </div>
            {servUnit !== 'g' && (
              <div className="flex flex-col">
                <label htmlFor={ids.density} className="sr-only">Density (g/ml)</label>
                <input id={ids.density} className="form-input" type="number" min={0.01} step={0.01} placeholder={`Density (g/ml)`} {...register('density', { valueAsNumber: true })} />
              </div>
            )}
            {labelPer100 && (
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn btn-secondary btn-sm" type="button" onClick={applyConverterValues}>
                  Apply ↓
                </button>
                <div className="text-xs text-text-muted dark:text-text-muted-dark">
                  <b>Per 100g:</b> {labelPer100.kcal.toFixed(0)}kcal, {labelPer100.fat.toFixed(1)}F, {labelPer100.carb.toFixed(1)}C, {labelPer100.protein.toFixed(1)}P
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-text dark:text-text-light">Create Food (values per 100g)</h4>
        <div>
          <label htmlFor={ids.description} className="sr-only">Description</label>
          <input id={ids.description} className="form-input" placeholder="Description (e.g., Pop-Tarts)" {...register('description', { required: 'Description is required' })} />
          {errors.description && <p className="text-xs text-brand-danger mt-1">{errors.description.message}</p>}
        </div>
        <div>
          <label htmlFor={ids.brand} className="sr-only">Brand / store</label>
          <input id={ids.brand} className="form-input" placeholder="Brand / store (optional)" {...register('brand_owner')} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <label htmlFor={ids.kcal} className="sr-only">kcal</label>
            <input id={ids.kcal} className="form-input" type="number" step="0.01" placeholder="kcal" {...register('kcal_per_100g', { required: true, valueAsNumber: true, min: 0 })} />
          </div>
          <div className="flex flex-col">
            <label htmlFor={ids.protein} className="sr-only">protein g</label>
            <input id={ids.protein} className="form-input" type="number" step="0.01" placeholder="protein g" {...register('protein_g_per_100g', { required: true, valueAsNumber: true, min: 0 })} />
          </div>
          <div className="flex flex-col">
            <label htmlFor={ids.fat} className="sr-only">fat g</label>
            <input id={ids.fat} className="form-input" type="number" step="0.01" placeholder="fat g" {...register('fat_g_per_100g', { required: true, valueAsNumber: true, min: 0 })} />
          </div>
          <div className="flex flex-col">
            <label htmlFor={ids.carb} className="sr-only">carb g</label>
            <input id={ids.carb} className="form-input" type="number" step="0.01" placeholder="carb g" {...register('carb_g_per_100g', { required: true, valueAsNumber: true, min: 0 })} />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button type="submit" className="btn btn-primary" disabled={isCreatingFood || !isValid}>
            {isCreatingFood ? 'Creating...' : 'Create Food'}
          </button>
        </div>
      </div>
    </form>
  );
}
