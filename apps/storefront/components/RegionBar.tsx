import type { DeliveryRegion } from "@ecommerce/types";

export function RegionBar({ region }: { region: DeliveryRegion }) {
  return (
    <div className="bg-brand-700 text-white text-sm">
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-1.5">
        <span aria-hidden>📍</span>
        <span>
          Você está em <strong className="font-semibold">{region.name}</strong>
        </span>
        <button className="ml-1 underline decoration-dotted underline-offset-2 hover:text-brand-100">
          trocar
        </button>
      </div>
    </div>
  );
}
