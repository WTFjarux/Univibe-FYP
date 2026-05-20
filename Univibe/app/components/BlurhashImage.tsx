import React from "react";
import { Image } from "expo-image";
import type { ImageProps } from "expo-image";

const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

interface BlurhashImageProps extends Omit<
  ImageProps,
  "source" | "placeholder"
> {
  uri: string;
  blurhash?: string;
}

const BlurhashImage: React.FC<BlurhashImageProps> = ({
  uri,
  blurhash = DEFAULT_BLURHASH,
  ...rest
}) => {
  return (
    <Image
      source={{ uri }}
      placeholder={{ blurhash }}
      contentFit="cover"
      transition={300}
      cachePolicy="memory-disk"
      {...rest}
    />
  );
};

export default React.memo(BlurhashImage);
