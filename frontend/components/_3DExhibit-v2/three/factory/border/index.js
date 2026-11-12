// @ts-check

import { BoxGeometry, Color, Mesh, MeshBasicMaterial } from "three"

import BorderMaterial from "./bordermaterial"
import PipeLineMesh from "../../abstract/pipelinemesh";


export const BORDER_SIZE = .05;

class Border {

	get( opts ){


        const { width, height, depth, borderSize, color } = opts

        const border = new PipeLineMesh(
            new BoxGeometry(
                width,
                height,
                depth
            ),
            new BorderMaterial({
                color: new Color(color || 0x000000),
                hasBorder: borderSize !== 0,
            }),
            {
                occlusionMaterial: new MeshBasicMaterial({ color: 0x000000 })
            }
        );

        border.userData.borderSizeWidth = 1 + BORDER_SIZE;

        border.userData.borderSizeHeight = 1 + (BORDER_SIZE / (height / width));

        border.scale.set(
            borderSize ? border.userData.borderSizeWidth : 1,
            borderSize ? border.userData.borderSizeHeight : 1,
            1
        );

        if (color === "transparent-borderless") {
            border.visible = false;
        }

        return border;

	}

    rescale(border, width, height) {
        //
        if(!border?.userData?.isBorder) return

        border.geometry.scale(
            width / border.userData.width,
            height / border.userData.height,
            1
        )

        border.geometry.parameters.width = width

        border.geometry.parameters.height = height

        border.userData.width = width

        border.userData.height = height
    }

    rescaleBorder({
        border,
        originalDimensions,
        newDimensions,
    }) {

        border.scale.set(1, 1, 1);

        border.geometry.scale(
            newDimensions.width / originalDimensions.width,
            newDimensions.height / originalDimensions.height,
            1
        )

        border.geometry.parameters.width = newDimensions.width

        border.geometry.parameters.height = newDimensions.height

        border.userData.width = newDimensions.width

        border.userData.height = newDimensions.height

        const newBorderWidth = 1 + BORDER_SIZE;

        const newBorderHeight = 1 + (BORDER_SIZE / (newDimensions.height / newDimensions.width));

        border.userData.borderSizeWidth = newBorderWidth;
        border.userData.borderSizeHeight = newBorderHeight;

        border.scale.set(newBorderWidth, newBorderHeight, 1);
    }
}

export default new Border()
