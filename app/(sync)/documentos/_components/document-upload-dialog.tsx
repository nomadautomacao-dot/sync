"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { CalendarOutlined, InboxOutlined, PaperClipOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Typography,
  Upload,
  theme,
} from "antd";
import type { UploadFile } from "antd";

import type { CityAccount } from "@/core/lib/city-types";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type CreateCityDocumentInput,
  type DocumentCategory,
} from "@/modules/documentos/types";
import {
  formatFileSize,
  validateCityDocumentFile,
} from "@/modules/documentos/documentos-firestore";

interface DocumentUploadDialogProps {
  open: boolean;
  cities: CityAccount[];
  initialCityId?: string;
  uploading: boolean;
  onClose: () => void;
  onSubmit: (
    file: File,
    input: Omit<
      CreateCityDocumentInput,
      "groupId" | "createdBy" | "createdByName"
    >,
  ) => Promise<void>;
}

/** Formato aceito pelo `Form`: as datas ficam como string ISO (yyyy-mm-dd), igual ao
 * que a API espera — o `DatePicker` é convertido de/para esse formato pelo par
 * `getValueProps`/`normalize` em cada campo. */
interface UploadFormValues {
  cityId: string;
  category: DocumentCategory;
  title: string;
  contractNumber?: string;
  signedAt?: string;
  expiresAt?: string;
  description?: string;
}

export function DocumentUploadDialog({
  open,
  cities,
  initialCityId,
  uploading,
  onClose,
  onSubmit,
}: DocumentUploadDialogProps) {
  const { token } = theme.useToken();
  const [form] = Form.useForm<UploadFormValues>();
  const category = Form.useWatch("category", form);
  const [file, setFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [error, setError] = useState("");

  const handleFinish = async (values: UploadFormValues) => {
    const city = cities.find((item) => item.id === values.cityId);
    if (!file) {
      setError("Selecione um arquivo.");
      return;
    }
    if (!city) {
      setError("Selecione o município do documento.");
      return;
    }

    setError("");
    try {
      await onSubmit(file, {
        cityId: city.id,
        cityName: city.name,
        cityUf: city.uf,
        category: values.category,
        title: values.title,
        description: values.description,
        contractNumber: values.contractNumber,
        signedAt: values.signedAt,
        expiresAt: values.expiresAt,
        source: "upload",
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível anexar o documento.",
      );
    }
  };

  return (
    <Modal
      open={open}
      title={
        <Flex align="center" gap={10}>
          <PaperClipOutlined style={{ color: token.colorInfoText }} />
          Anexar documento
        </Flex>
      }
      onCancel={() => {
        if (!uploading) onClose();
      }}
      closable={!uploading}
      mask={{ closable: !uploading }}
      /* Centrado, e o corpo limitado à janela. Ancorado no topo, o formulário
         de anexo passava da altura de um notebook e o botão de enviar ficava
         fora da tela. */
      centered
      width={680}
      styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowY: "auto" } }}
      footer={[
        <Button key="cancelar" onClick={onClose} disabled={uploading}>
          Cancelar
        </Button>,
        <Button
          key="enviar"
          type="primary"
          icon={<PaperClipOutlined />}
          loading={uploading}
          onClick={() => form.submit()}
        >
          Anexar documento
        </Button>,
      ]}
    >
      <Typography.Paragraph type="secondary">
        Organize o arquivo na pasta digital do município.
      </Typography.Paragraph>

      <Form<UploadFormValues>
        form={form}
        layout="vertical"
        initialValues={{ cityId: initialCityId ?? "", category: "contrato" }}
        onFinish={handleFinish}
      >
        <Form.Item label="Arquivo" required>
          <Upload.Dragger
            fileList={fileList}
            maxCount={1}
            multiple={false}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
            beforeUpload={(nextFile) => {
              const validationError = validateCityDocumentFile(nextFile);
              if (validationError) {
                setError(validationError);
                return Upload.LIST_IGNORE;
              }
              setError("");
              setFile(nextFile);
              if (!form.getFieldValue("title")) {
                form.setFieldValue(
                  "title",
                  nextFile.name.replace(/\.[^.]+$/, ""),
                );
              }
              // Retornar false impede o upload automático do Ant: o envio real
              // acontece no submit do formulário, via `onSubmit`.
              return false;
            }}
            onChange={(info) => setFileList(info.fileList.slice(-1))}
            onRemove={() => {
              setFile(null);
              setFileList([]);
            }}
          >
            <Flex vertical align="center" gap={4} style={{ padding: "12px 0" }}>
              <InboxOutlined style={{ fontSize: 26, color: token.colorTextSecondary }} />
              <Typography.Text strong>
                {file ? file.name : "Arraste o arquivo ou clique para selecionar"}
              </Typography.Text>
              <Typography.Text
                type="secondary"
                style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}
              >
                {file
                  ? formatFileSize(file.size)
                  : "PDF, DOCX, XLSX, imagem ou ZIP · máximo 20 MB"}
              </Typography.Text>
            </Flex>
          </Upload.Dragger>
        </Form.Item>

        <Flex gap={16}>
          <Form.Item
            name="cityId"
            label="Município"
            style={{ flex: 1 }}
            rules={[
              { required: true, message: "Selecione o município do documento." },
            ]}
          >
            <Select
              placeholder="Selecione o município"
              showSearch
              optionFilterProp="label"
              options={cities.map((city) => ({
                value: city.id,
                label: `${city.name} · ${city.uf}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="category" label="Categoria" style={{ flex: 1 }}>
            <Select
              options={DOCUMENT_CATEGORIES.map((item) => ({
                value: item,
                label: DOCUMENT_CATEGORY_LABELS[item],
              }))}
            />
          </Form.Item>
        </Flex>

        <Form.Item
          name="title"
          label="Título do documento"
          rules={[{ required: true, message: "Informe o título do documento." }]}
        >
          <Input placeholder="Ex.: Contrato de consultoria FUNDEB 2026" />
        </Form.Item>

        {category === "contrato" && (
          <Flex
            vertical
            gap={12}
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadius,
              background: token.colorFillQuaternary,
              padding: 14,
              marginBottom: 24,
            }}
          >
            <Flex align="center" gap={8}>
              <CalendarOutlined style={{ color: token.colorTextSecondary }} />
              <Typography.Text strong style={{ fontSize: 12 }}>
                Dados do contrato
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                opcional
              </Typography.Text>
            </Flex>
            <Flex gap={12} wrap="wrap">
              <Form.Item
                name="contractNumber"
                label="Número"
                style={{ flex: 1, minWidth: 140, marginBottom: 0 }}
              >
                <Input placeholder="001/2026" />
              </Form.Item>
              <Form.Item
                name="signedAt"
                label="Assinatura"
                style={{ flex: 1, minWidth: 140, marginBottom: 0 }}
                getValueProps={(value: string | undefined) => ({
                  value: value ? dayjs(value) : undefined,
                })}
                normalize={(value: dayjs.Dayjs | null) =>
                  value ? value.format("YYYY-MM-DD") : ""
                }
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item
                name="expiresAt"
                label="Vencimento"
                style={{ flex: 1, minWidth: 140, marginBottom: 0 }}
                getValueProps={(value: string | undefined) => ({
                  value: value ? dayjs(value) : undefined,
                })}
                normalize={(value: dayjs.Dayjs | null) =>
                  value ? value.format("YYYY-MM-DD") : ""
                }
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Flex>
          </Flex>
        )}

        <Form.Item name="description" label="Observações">
          <Input.TextArea
            rows={3}
            placeholder="Contexto, responsável ou informação útil para localizar o documento…"
          />
        </Form.Item>

        {error && (
          <Alert type="error" showIcon title={error} style={{ marginBottom: 8 }} />
        )}
      </Form>
    </Modal>
  );
}
