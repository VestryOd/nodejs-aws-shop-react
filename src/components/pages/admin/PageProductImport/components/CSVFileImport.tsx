import axios from "axios";
import React, { useRef } from "react";
import Box from "@mui/material/Box";
import { Button } from "@mui/material";
import { useInvalidateAvailableProducts } from "~/queries/products";
import { emitError } from "~/utils/emitError";

type CSVFileImportProps = {
  url: string;
  title: string;
};

export default function CSVFileImport({ url }: CSVFileImportProps) {
  const [file, setFile] = React.useState<File>();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const invalidateAvailableProducts = useInvalidateAvailableProducts();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setFile(file);
    }
  };

  const removeFile = () => {
    setFile(undefined);
  };

  const uploadFile = async () => {
    console.log("uploadFile to", url);

    try {
      if (!file) {
        throw new Error("No file selected");
      }
      const token = localStorage.getItem("authorization_token");
      // Get the presigned URL
      const response = await axios({
        method: "GET",
        url,
        params: {
          name: encodeURIComponent(file.name),
        },
        headers: token
          ? {
              Authorization: `Basic ${token}`,
            }
          : {},
      });
      console.log("File to upload: ", file.name);
      console.log("Uploading to: ", response.data);
      const result = await fetch(response.data.signedUrl, {
        method: "PUT",
        body: file,
      });
      console.log("Result: ", result);
      await invalidateAvailableProducts();
      setFile(undefined);
    } catch (error: any) {
      console.error("There was an error uploading the file::", error);
      emitError(error);
    }
  };
  return (
    <Box>
      {file ? (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            size="small"
            color="warning"
            variant="contained"
            onClick={removeFile}
          >
            Remove file
          </Button>
          <Button
            size="small"
            color="secondary"
            variant="contained"
            onClick={uploadFile}
          >
            Upload file
          </Button>
        </div>
      ) : (
        <>
          <input
            hidden
            type="file"
            accept=".csv"
            onChange={onFileChange}
            ref={uploadInputRef}
          />
          <Button
            size="small"
            color="primary"
            variant="contained"
            onClick={() =>
              uploadInputRef.current && uploadInputRef.current.click()
            }
          >
            Import CSV File
          </Button>
        </>
      )}
    </Box>
  );
}
