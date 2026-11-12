import { getDefaultGridData } from "@3factory/space/kits/cyber/components/grid/data";
import { getDefaultBackgroundData } from "@3factory/space/kits/cyber/components/backrground/data";

export function getDefaultComponents() {
    //
    return {
        grid: getDefaultGridData(),
        background: getDefaultBackgroundData(),
    };
}
