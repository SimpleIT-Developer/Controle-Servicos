import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { insertNfseConfigSchema, type InsertNfseConfig, type NfseConfig, type Company } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Upload, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function NfseConfigPage() {
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const { data: companies } = useQuery<Company[]>({ 
    queryKey: ["/api/companies"],
  });

  const { data: config, isLoading } = useQuery<NfseConfig>({
    queryKey: ["/api/nfse/config", selectedCompanyId],
    queryFn: async () => {
        if (!selectedCompanyId) return {};
        const res = await fetch(`/api/nfse/config?companyId=${selectedCompanyId}`);
        if (!res.ok) throw new Error("Failed to fetch config");
        return res.json();
    },
    enabled: !!selectedCompanyId
  });

  const formSchema = insertNfseConfigSchema.extend({
    file: z.any().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cnpjPrestador: "",
      inscricaoMunicipal: "",
      codigoMunicipioIbge: "",
      regimeTributario: "",
      itemServico: "11.01",
      cnae: "",
      descricaoServicoPadrao: "Serviço de administração de imóveis",
      aliquotaIss: "0",
      issRetido: false,
      ambiente: "homologacao",
      certificadoSenha: "",
      ultimoNumeroNfse: 0,
      serieNfse: "900",
    },
  });

  useEffect(() => {
    if (config && Object.keys(config).length > 0) {
      form.reset({
        cnpjPrestador: config.cnpjPrestador || "",
        inscricaoMunicipal: config.inscricaoMunicipal || "",
        codigoMunicipioIbge: config.codigoMunicipioIbge || "",
        regimeTributario: config.regimeTributario || "",
        itemServico: config.itemServico || "11.01",
        cnae: config.cnae || "",
        descricaoServicoPadrao: config.descricaoServicoPadrao || "",
        aliquotaIss: config.aliquotaIss?.toString() || "0",
        issRetido: config.issRetido || false,
        ambiente: config.ambiente || "homologacao",
        certificadoSenha: config.certificadoSenha || "",
        ultimoNumeroNfse: config.ultimoNumeroNfse || 0,
        serieNfse: config.serieNfse || "900",
      });
    } else {
        form.reset({
            cnpjPrestador: "",
            inscricaoMunicipal: "",
            codigoMunicipioIbge: "",
            regimeTributario: "",
            itemServico: "11.01",
            cnae: "",
            descricaoServicoPadrao: "Serviço de administração de imóveis",
            aliquotaIss: "0",
            issRetido: false,
            ambiente: "homologacao",
            certificadoSenha: "",
            ultimoNumeroNfse: 0,
            serieNfse: "900",
        });
    }
  }, [config, form, selectedCompanyId]);

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const formData = new FormData();
      
      Object.entries(data).forEach(([key, value]) => {
          if (key === 'file') {
              if (value && value.length > 0) {
                  formData.append('certificado', value[0]);
              }
          } else if (value !== undefined && value !== null) {
              formData.append(key, String(value));
          }
      });
      
      formData.append('companyId', selectedCompanyId);

      const res = await fetch("/api/nfse/config", {
          method: "POST",
          body: formData,
      });
      
      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfse/config", selectedCompanyId] });
      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configuração NFS-e</h1>
        <p className="text-muted-foreground mt-2">
          Defina os parâmetros para emissão de Nota Fiscal de Serviço Eletrônica por empresa.
        </p>
      </div>

      <Card className="mb-6">
          <CardHeader>
              <CardTitle>Seleção de Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full md:w-1/2">
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa para configurar" />
                    </SelectTrigger>
                    <SelectContent>
                        {companies?.map(company => (
                            <SelectItem key={company.id} value={company.id}>
                                {company.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </CardContent>
      </Card>

      {!selectedCompanyId ? (
          <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                  Selecione uma empresa acima para visualizar e editar as configurações de NFS-e.
              </AlertDescription>
          </Alert>
      ) : (
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa Emissora</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                  <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
              ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="cnpjPrestador"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CNPJ do Prestador</FormLabel>
                              <FormControl>
                                <Input placeholder="00.000.000/0000-00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="inscricaoMunicipal"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Inscrição Municipal</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: 123456" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="codigoMunicipioIbge"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código IBGE do Município</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: 3554003 (Tatuí/SP)" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="regimeTributario"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Regime Tributário</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1">Simples Nacional</SelectItem>
                                  <SelectItem value="2">Lucro Presumido</SelectItem>
                                  <SelectItem value="3">Lucro Real</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="itemServico"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item da Lista de Serviço (LC 116)</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: 11.01" {...field} />
                              </FormControl>
                              <FormDescription>
                                Código do serviço conforme Lei Complementar 116.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="aliquotaIss"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alíquota ISS (%)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="Ex: 2.00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="cnae"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CNAE (Opcional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: 6821801" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ambiente"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ambiente</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="homologacao">Homologação (Teste)</SelectItem>
                                  <SelectItem value="producao">Produção</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <FormField
                          control={form.control}
                          name="ultimoNumeroNfse"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Último Número NFS-e</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="Ex: 0" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormDescription>
                                Número da última nota emitida. O sistema usará o próximo (n+1).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="serieNfse"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Série da NFS-e</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: 900" {...field} />
                              </FormControl>
                              <FormDescription>
                                Série utilizada para emissão (padrão 900 para homologação).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="descricaoServicoPadrao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição Padrão do Serviço</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Honorários administrativos..." {...field} />
                            </FormControl>
                            <FormDescription>
                              Texto padrão a ser usado caso não seja especificado na emissão.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="file"
                            render={({ field: { value, onChange, ...field } }) => (
                            <FormItem>
                                <FormLabel>Certificado Digital (PFX/P12)</FormLabel>
                                <FormControl>
                                <Input 
                                    {...field}
                                    value={undefined}
                                    onChange={(event) => {
                                        onChange(event.target.files);
                                    }}
                                    type="file" 
                                    accept=".pfx,.p12"
                                />
                                </FormControl>
                                <FormDescription>
                                Arquivo do certificado digital A1.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="certificadoSenha"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Senha do Certificado Digital</FormLabel>
                                <FormControl>
                                <Input type="password" placeholder="Senha do arquivo .pfx" {...field} />
                                </FormControl>
                                <FormDescription>
                                Necessária para assinar o XML.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="issRetido"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                ISS Retido
                              </FormLabel>
                              <FormDescription>
                                Marque se o ISS é retido pelo tomador.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end">
                        <Button type="submit" disabled={mutation.isPending}>
                          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Save className="mr-2 h-4 w-4" />
                          Salvar Configurações
                        </Button>
                      </div>
                    </form>
                  </Form>
              )}
            </CardContent>
          </Card>
      )}
    </div>
  );
}