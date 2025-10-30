// Configurações - IMPORTANTE: Substitua com suas credenciais
const CONFIG = {
    hubspotPortalId: '50536787',                              // HubSpot Portal ID
    hubspotFormId: '0a12dcbf-0c77-4ae3-86c8-fe7604dd4b85',   // HubSpot Form ID
    metaPixelId: '1581222786653125'                           // Meta Pixel ID
};

// Utilitários de validação
const Validator = {
    email: (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    telefone: (telefone) => {
        const cleaned = telefone.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 11;
    },

    nome: (nome) => {
        return nome.trim().length >= 3 && nome.trim().includes(' ');
    }
};

// Formatação de telefone
function formatarTelefone(value) {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length <= 10) {
        formatted = cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
        formatted = cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    return formatted;
}

// Captura de parâmetros UTM para tracking
function getUTMParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        utm_source: urlParams.get('utm_source') || '',
        utm_medium: urlParams.get('utm_medium') || '',
        utm_campaign: urlParams.get('utm_campaign') || '',
        utm_content: urlParams.get('utm_content') || '',
        utm_term: urlParams.get('utm_term') || ''
    };
}

// Envio para HubSpot
async function enviarParaHubSpot(formData) {
    const url = `https://api.hsforms.com/submissions/v3/integration/submit/${CONFIG.hubspotPortalId}/${CONFIG.hubspotFormId}`;

    const utmParams = getUTMParams();

    // Preparar dados no formato do HubSpot
    const hubspotData = {
        fields: [
            { name: 'firstname', value: formData.nome.split(' ')[0] },
            { name: 'lastname', value: formData.nome.split(' ').slice(1).join(' ') },
            { name: 'email', value: formData.email },
            { name: 'phone', value: formData.telefone },
            { name: 'tipo_veiculo', value: formData.veiculo },
            { name: 'marca_veiculo', value: formData.marca || '' },
            { name: 'modelo_veiculo', value: formData.modelo || '' },
            { name: 'city', value: formData.cidade }
        ],
        context: {
            pageUri: window.location.href,
            pageName: document.title,
            hutk: getCookie('hubspotutk') // Cookie de tracking do HubSpot
        }
    };

    // Adicionar UTM params se existirem
    if (utmParams.utm_source) {
        hubspotData.fields.push({ name: 'utm_source', value: utmParams.utm_source });
        hubspotData.fields.push({ name: 'utm_medium', value: utmParams.utm_medium });
        hubspotData.fields.push({ name: 'utm_campaign', value: utmParams.utm_campaign });
        hubspotData.fields.push({ name: 'utm_content', value: utmParams.utm_content });
        hubspotData.fields.push({ name: 'utm_term', value: utmParams.utm_term });
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(hubspotData)
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao enviar para HubSpot:', error);
        throw error;
    }
}

// Pegar cookie do HubSpot para tracking
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
}

// Evento de conversão no Meta Pixel
function trackMetaConversion(leadData) {
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Lead', {
            content_name: 'Cotação Proteção Veicular',
            content_category: leadData.veiculo,
            value: 0,
            currency: 'BRL'
        });
        console.log('✓ Conversão registrada no Meta Pixel');
    }
}

// Salvar lead localmente (backup)
function salvarLeadLocal(leadData) {
    try {
        const leads = JSON.parse(localStorage.getItem('leads') || '[]');
        leads.push({
            ...leadData,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('leads', JSON.stringify(leads));
        console.log('✓ Lead salvo localmente');
    } catch (error) {
        console.error('Erro ao salvar lead localmente:', error);
    }
}

// Validação e estilo do formulário
function validarCampo(input) {
    const formGroup = input.closest('.form-group');
    let isValid = true;

    if (input.hasAttribute('required') && !input.value.trim()) {
        isValid = false;
    } else if (input.type === 'email' && !Validator.email(input.value)) {
        isValid = false;
    } else if (input.id === 'telefone' && !Validator.telefone(input.value)) {
        isValid = false;
    } else if (input.id === 'nome' && !Validator.nome(input.value)) {
        isValid = false;
    }

    if (isValid) {
        formGroup.classList.remove('error');
    } else {
        formGroup.classList.add('error');
    }

    return isValid;
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('leadForm');
    const telefoneInput = document.getElementById('telefone');
    const submitBtn = document.getElementById('submitBtn');
    const successMessage = document.getElementById('successMessage');

    // Formatação automática do telefone
    telefoneInput.addEventListener('input', function(e) {
        this.value = formatarTelefone(this.value);
    });

    // Validação em tempo real
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validarCampo(this);
        });

        input.addEventListener('input', function() {
            if (this.closest('.form-group').classList.contains('error')) {
                validarCampo(this);
            }
        });
    });

    // Submissão do formulário
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Validar todos os campos
        let formIsValid = true;
        inputs.forEach(input => {
            if (!validarCampo(input)) {
                formIsValid = false;
            }
        });

        if (!formIsValid) {
            return;
        }

        // Desabilitar botão durante o envio
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        // Coletar dados do formulário
        const formData = {
            nome: document.getElementById('nome').value,
            email: document.getElementById('email').value,
            telefone: document.getElementById('telefone').value,
            veiculo: document.getElementById('veiculo').value,
            marca: document.getElementById('marca').value,
            modelo: document.getElementById('modelo').value,
            cidade: document.getElementById('cidade').value
        };

        try {
            // Salvar localmente primeiro (backup)
            salvarLeadLocal(formData);

            // Enviar para HubSpot
            await enviarParaHubSpot(formData);
            console.log('✓ Lead enviado para HubSpot com sucesso');

            // Registrar conversão no Meta Pixel
            trackMetaConversion(formData);

            // Mostrar mensagem de sucesso
            successMessage.classList.add('show');
            form.reset();

            // Scroll para a mensagem de sucesso
            successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Opcional: Redirecionar para página de agradecimento após 3 segundos
            setTimeout(() => {
                // window.location.href = '/obrigado.html';
            }, 3000);

        } catch (error) {
            console.error('Erro ao processar lead:', error);
            alert('Ocorreu um erro ao enviar seus dados. Por favor, tente novamente ou entre em contato pelo WhatsApp.');
        } finally {
            // Reabilitar botão
            submitBtn.disabled = false;
            submitBtn.textContent = 'Solicitar Cotação Gratuita';
        }
    });

    // Log para debug
    console.log('✓ Sistema de captação de leads inicializado');
    console.log('UTM Parameters:', getUTMParams());
});
