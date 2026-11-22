import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators";
import { getAreasFloorHierarchy } from "../../../common/areas/areas-floor-hierarchy";
import {
  findEntities,
  generateEntityFilter,
} from "../../../common/entity/entity_filter";
import { floorDefaultIcon } from "../../../components/ha-floor-icon";
import type { LovelaceCardConfig } from "../../../data/lovelace/config/card";
import type { LovelaceSectionRawConfig } from "../../../data/lovelace/config/section";
import type { LovelaceViewConfig } from "../../../data/lovelace/config/view";
import type { HomeAssistant } from "../../../types";
import { computeAreaTileCardConfig } from "../../lovelace/strategies/areas/helpers/areas-strategy-helper";
import type { LovelaceStrategyDependency } from "../../lovelace/strategies/types";
import type { EntityFilter } from "../../../common/entity/entity_filter";

export interface AirQualityViewStrategyConfig {
  type: "air-quality";
}

export const airQualityEntityFilters: EntityFilter[] = [
  { domain: "air_quality", entity_category: "none" },
  {
    domain: "sensor",
    device_class: [
      "absolute_humidity",
      "aqi",
      "carbon_dioxide",
      "carbon_monoxide",
      "humidity",
      "nitrogen_dioxide",
      "nitrogen_monoxide",
      "nitrous_oxide",
      "ozone",
      "pm1",
      "pm10",
      "pm25",
      "pm4",
      "radon",
      "sulphur_dioxide",
      "volatile_organic_compounds",
      "volatile_organic_compounds_parts",
    ],
    entity_category: "none",
  },
];

const processAreasForAirQuality = (
  areaIds: string[],
  hass: HomeAssistant,
  entities: string[]
): LovelaceCardConfig[] => {
  const cards: LovelaceCardConfig[] = [];
  const computeTileCard = computeAreaTileCardConfig(hass, true);

  for (const areaId of areaIds) {
    const area = hass.areas[areaId];
    if (!area) {
      continue;
    }

    const areaFilter = generateEntityFilter(
      hass.states,
      hass.entities,
      hass.devices,
      hass.areas,
      hass.floors,
      {
        area: area.area_id,
      }
    );
    const areaEntities = entities.filter(areaFilter);

    if (areaEntities.length === 0) {
      continue;
    }

    cards.push({
      heading_style: "subtitle",
      type: "heading",
      heading: area.name,
      tap_action: hass.panels.home
        ? {
            action: "navigate",
            navigation_path: `/home/areas-${area.area_id}`,
          }
        : undefined,
    });
    cards.push(...areaEntities.map(computeTileCard));
  }

  return cards;
};

const processUnassignedEntities = (
  hass: HomeAssistant,
  entities: string[]
): LovelaceCardConfig[] => {
  const unassignedFilter = generateEntityFilter(
    hass.states,
    hass.entities,
    hass.devices,
    hass.areas,
    hass.floors,
    {
      area: null,
    }
  );
  const computeTileCard = computeAreaTileCardConfig(hass, true);

  return entities
    .filter(unassignedFilter)
    .map((entityId) => computeTileCard(entityId));
};

@customElement("air-quality-view-strategy")
export class AirQualityViewStrategy extends ReactiveElement {
  static registryDependencies: readonly LovelaceStrategyDependency[] = [
    "entities",
    "devices",
    "areas",
    "floors",
    "panels",
  ];

  static async generate(
    _config: AirQualityViewStrategyConfig,
    hass: HomeAssistant
  ): Promise<LovelaceViewConfig> {
    const areas = Object.values(hass.areas);
    const floors = Object.values(hass.floors);
    const home = getAreasFloorHierarchy(floors, areas);
    const sections: LovelaceSectionRawConfig[] = [];

    const filters = airQualityEntityFilters.map((filter) =>
      generateEntityFilter(
        hass.states,
        hass.entities,
        hass.devices,
        hass.areas,
        hass.floors,
        filter
      )
    );
    const entities = findEntities(Object.keys(hass.states), filters);

    const floorCount = home.floors.length + (home.areas.length ? 1 : 0);

    for (const floorStructure of home.floors) {
      const floor = hass.floors[floorStructure.id];
      const cards = processAreasForAirQuality(
        floorStructure.areas,
        hass,
        entities
      );

      if (cards.length === 0) {
        continue;
      }

      sections.push({
        type: "grid",
        column_span: 2,
        cards: [
          {
            type: "heading",
            heading:
              floorCount > 1
                ? floor.name
                : hass.localize("ui.panel.lovelace.strategy.home.areas"),
            icon: floor.icon || floorDefaultIcon(floor),
          },
          ...cards,
        ],
      });
    }

    if (home.areas.length > 0) {
      const cards = processAreasForAirQuality(home.areas, hass, entities);

      if (cards.length > 0) {
        sections.push({
          type: "grid",
          column_span: 2,
          cards: [
            {
              type: "heading",
              heading:
                floorCount > 1
                  ? hass.localize("ui.panel.lovelace.strategy.home.other_areas")
                  : hass.localize("ui.panel.lovelace.strategy.home.areas"),
            },
            ...cards,
          ],
        });
      }
    }

    const unassignedCards = processUnassignedEntities(hass, entities);

    if (unassignedCards.length > 0) {
      sections.push({
        type: "grid",
        column_span: 2,
        cards: [
          {
            type: "heading",
            heading:
              sections.length > 0
                ? hass.localize("ui.panel.lovelace.strategy.home.others")
                : hass.localize("panel.air_quality"),
          },
          ...unassignedCards,
        ],
      });
    }

    return {
      type: "sections",
      max_columns: 2,
      sections,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "air-quality-view-strategy": AirQualityViewStrategy;
  }
}
