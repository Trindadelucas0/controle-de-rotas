import { IconTile } from "@/components/reui/icon-tile"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FolderIcon } from "lucide-react"

export function Pattern() {
  return (
    <div className="flex items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <IconTile variant="frame" size="xl" aria-hidden="true">
              <FolderIcon
              />
            </IconTile>
          </EmptyMedia>
          <EmptyTitle>No files yet</EmptyTitle>
          <EmptyDescription>
            Upload a file to get started. Everything you add shows up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}